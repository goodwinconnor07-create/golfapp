import { useState } from 'react';
import { makeHoles } from '../game';
import { createLocalGame, useApp, withCoursePars } from '../state/store';
import { BackBar, Stepper } from '../ui/components';

const PRESETS = [
  { label: 'Front 9', detail: 'Holes 1 to 9', count: 9, start: 1, className: 'btn-green' },
  { label: 'Back 9', detail: 'Holes 10 to 18', count: 9, start: 10, className: 'btn-blue' },
  { label: '18 holes', detail: 'The full round', count: 18, start: 1, className: 'btn-brand' },
];

export function SetupHoles() {
  const [custom, setCustom] = useState(false);
  const [count, setCount] = useState(6);
  const [start, setStart] = useState(1);
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
            onClick={() => createLocalGame(makeHoles(p.count, p.start))}
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
        {!custom ? (
          <button type="button" className="btn btn-outline" onClick={() => setCustom(true)}>
            Something else
          </button>
        ) : (
          <div className="tile steppers rise">
            <div className="center">
              <p className="label">Holes</p>
              <Stepper value={count} min={1} max={18} onChange={setCount} label="holes" />
            </div>
            <div className="center">
              <p className="label">Starting on hole</p>
              <Stepper value={start} min={1} max={18} onChange={setStart} label="starting hole" />
            </div>
            <button type="button" className="btn btn-xl btn-dark" onClick={() => createLocalGame(makeHoles(count, start))}>
              Play {count} hole{count === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
