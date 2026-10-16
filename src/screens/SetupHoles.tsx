import { makeHoles } from '../game';
import { createLocalGame, useApp, withCoursePars } from '../state/store';
import { BackBar } from '../ui/components';
import { colourWipe } from '../ui/effects';

const PRESETS = [
  { label: 'Front 9', detail: 'Holes 1 to 9', count: 9, start: 1, className: 'btn-green' },
  { label: 'Back 9', detail: 'Holes 10 to 18', count: 9, start: 10, className: 'btn-blue' },
  { label: '18 holes', detail: 'The full round', count: 18, start: 1, className: 'btn-dark' },
];

export function SetupHoles() {
  const course = useApp((s) => s.draft.course);
  const hasPars = Boolean(course?.pars.length);
  // Total par for a preset, when the course gives us hole pars.
  const parFor = (n: number, from: number) => {
    const holes = withCoursePars(makeHoles(n, from), course);
    return holes.every((h) => h.par) ? holes.reduce((t, h) => t + (h.par ?? 0), 0) : null;
  };

  return (
    <div className="screen">
      <BackBar title="New game" />
      <div className="screen-body">
        <h1 className="h1">How many holes?</h1>
        <p className="muted" style={{ margin: 0 }}>
          {course ? (
            <>
              <b style={{ color: 'var(--ink)' }}>{course.name}</b>
              {hasPars ? ' · pars filled in for you' : " · we'll ask the par on each tee"}
            </>
          ) : (
            "We'll ask the par on each tee."
          )}
        </p>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className={`choice btn ${p.className}`}
            onClick={(e) => colourWipe(e, () => createLocalGame(makeHoles(p.count, p.start)))}
          >
            <span className="choice-num">{p.count}</span>
            <span className="choice-text">
              <b>{p.label}</b>
              <small>
                {p.detail}
                {parFor(p.count, p.start) ? ` · par ${parFor(p.count, p.start)}` : ''}
              </small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
