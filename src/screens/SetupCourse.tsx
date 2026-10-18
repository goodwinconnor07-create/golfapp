import { useEffect, useRef, useState } from 'react';
import { makeHoles, type CourseDetail, type CourseSummary } from '../game';
import { fetchCourse, searchCourses } from '../state/courses';
import { createLocalGame, setDraftCourse, toast, useApp, withCoursePars } from '../state/store';
import { BackBar, SkeletonRows } from '../ui/components';
import { colourWipe, haptic } from '../ui/effects';
import { FlagIcon } from '../ui/Icons';

const RECENT_KEY = 'sendit.courses';

function loadRecent(): CourseDetail[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(list) ? list.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveRecent(course: CourseDetail) {
  try {
    const list = [course, ...loadRecent().filter((c) => c.id !== course.id)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: recents just won't be remembered.
  }
}

const PRESETS = [
  { label: 'Front 9', count: 9, start: 1, className: 'btn-green' },
  { label: 'Back 9', count: 9, start: 10, className: 'btn-blue' },
  { label: '18 holes', count: 18, start: 1, className: 'btn-insane' },
];

/** Front 9, Back 9 or 18, with each one's total par when the course has pars. A 9-hole course only plays 9. */
function HoleChoices({ course }: { course: CourseDetail | null }) {
  const nine = course?.pars.length === 9;
  const presets = nine ? [{ ...PRESETS[0], label: '9 holes' }] : PRESETS;
  const parFor = (n: number, from: number) => {
    const holes = withCoursePars(makeHoles(n, from), course);
    return holes.every((h) => h.par) ? holes.reduce((t, h) => t + (h.par ?? 0), 0) : null;
  };
  return (
    <div className="hole-choices rise">
      {presets.map((p) => {
        const par = parFor(p.count, p.start);
        return (
          <button
            key={p.label}
            type="button"
            className={`btn hole-choice ${p.className}`}
            onClick={(e) => colourWipe(e, () => createLocalGame(makeHoles(p.count, p.start)))}
          >
            <b>{p.label}</b>
            {par && <small>par {par}</small>}
          </button>
        );
      })}
    </div>
  );
}

/** Setup step 2: find the course so hole pars fill themselves in, then pick which holes to play. */
export function SetupCourse() {
  const server = useApp((s) => s.server);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CourseSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  // The course whose row is open showing the hole choices, or 'none' when skipped.
  const [picked, setPicked] = useState<CourseDetail | 'none' | null>(null);
  const recent = useRef(loadRecent()).current;
  const lastQuery = useRef('');

  // Search as you type, after a short pause.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) {
      setResults([]);
      setError('');
      return;
    }
    const timer = setTimeout(async () => {
      lastQuery.current = query;
      setSearching(true);
      try {
        const found = await searchCourses(query);
        if (lastQuery.current === query) {
          setResults(found);
          setError(found.length ? '' : 'none');
        }
      } catch (e) {
        if (lastQuery.current === query) setError(e instanceof Error ? e.message : "Couldn't search right now.");
      } finally {
        if (lastQuery.current === query) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [q, retry]);

  const choose = async (id: string, known?: CourseDetail) => {
    setLoadingId(id);
    try {
      const course = known ?? (await fetchCourse(id));
      saveRecent(course);
      setDraftCourse(course);
      haptic('medium');
      if (!course.pars.length) toast(`We don't have hole pars for ${course.name} yet, so we'll ask on each tee.`);
      setPicked(course);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't load that course.", 'error');
    } finally {
      setLoadingId(null);
    }
  };

  const skip = () => {
    setDraftCourse(null);
    setPicked('none');
  };

  const showRecent = q.trim().length < 3 && recent.length > 0;

  return (
    <div className="screen">
      <BackBar title="New game" />
      <div className="screen-body">
        <h1 className="h1">Where are you playing?</h1>
        <input
          className="field"
          value={q}
          placeholder="Search for your course"
          aria-label="Search for your course"
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => setQ(e.target.value)}
        />
        {server === 'down' && <p className="note">Course search needs a connection. You can skip and enter pars on each tee.</p>}
        {searching && results.length === 0 && (
          // Placeholder rows while results load, shaped like the real ones.
          <SkeletonRows label="Searching" />
        )}
        {error === 'none' && !searching && (
          <div className="empty-state">
            <span className="empty-emoji" aria-hidden>
              ⛳
            </span>
            <b>No courses by that name</b>
            <span>Try a shorter name or the town. Or skip it and enter the par on each tee.</span>
          </div>
        )}
        {error && error !== 'none' && !searching && (
          <div className="empty-state">
            <b>{error}</b>
            <span>Check your signal and try again, or skip it and enter the par on each tee.</span>
            <button type="button" className="btn btn-sm btn-blue btn-auto" onClick={() => setRetry((n) => n + 1)}>
              Try again
            </button>
          </div>
        )}

        {showRecent && <p className="section-title">Recent</p>}
        <div className="stack">
          {(showRecent ? recent : results).map((c) => {
            const open = picked !== null && picked !== 'none' && picked.id === c.id;
            return (
              <div key={c.id} className={open ? 'course-open' : undefined}>
                <button
                  type="button"
                  className="player-row press course-row"
                  aria-expanded={open}
                  disabled={loadingId !== null}
                  onClick={() => void choose(c.id, showRecent ? (c as CourseDetail) : undefined)}
                >
                  <span className="course-icon" aria-hidden>
                    <FlagIcon width={24} height={24} />
                  </span>
                  <span className="course-text">
                    <b>{c.name}</b>
                    {c.place && <small>{c.place}</small>}
                  </span>
                  {loadingId === c.id ? (
                    <span className="spinner" aria-label="Loading" />
                  ) : c.par ? (
                    <span className="tag tag-waiting">Par {c.par}</span>
                  ) : null}
                </button>
                {open && <HoleChoices course={picked} />}
              </div>
            );
          })}
        </div>
        {results.length > 0 && (
          <p className="note small">Course data from GolfCore, GolfCourseAPI, and © OpenStreetMap contributors (ODbL) via OpenGolfAPI.</p>
        )}
      </div>
      <div className="screen-foot">
        {picked === 'none' ? (
          <>
            <p className="note center">No course? Pick your holes and we'll ask the par on each tee.</p>
            <HoleChoices course={null} />
          </>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={skip}>
            Skip, no course
          </button>
        )}
      </div>
    </div>
  );
}
