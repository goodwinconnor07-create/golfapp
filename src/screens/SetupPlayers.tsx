import { useRef } from 'react';
import { cleanName, LIMITS } from '../game';
import { navigate, setDraftNames, useApp } from '../state/store';
import { Avatar, BackBar } from '../ui/components';
import { CloseIcon, PlusIcon } from '../ui/Icons';

export function SetupPlayers() {
  const names = useApp((s) => s.draft.names);
  const list = useRef<HTMLDivElement>(null);
  const valid = names.some((n) => cleanName(n));

  const update = (i: number, value: string) => setDraftNames(names.map((n, j) => (j === i ? value : n)));
  const remove = (i: number) => setDraftNames(names.filter((_, j) => j !== i));
  const add = () => {
    if (names.length >= LIMITS.maxPlayers) return;
    setDraftNames([...names, '']);
    requestAnimationFrame(() => list.current?.querySelector<HTMLInputElement>('.name-row:last-child input')?.focus());
  };

  return (
    <div className="screen">
      <BackBar title="New game" />
      <div className="screen-body">
        <h1 className="h1">Who's playing?</h1>
        <p className="muted" style={{ margin: 0 }}>
          Add your group. Friends with phones can join with a code later.
        </p>
        <div className="stack" ref={list}>
          {names.map((name, i) => (
            <div className="name-row" key={i}>
              <Avatar player={{ name: name || String(i + 1), color: i }} size={50} />
              <input
                className="field"
                value={name}
                placeholder={i === 0 ? 'Your name' : `Player ${i + 1}`}
                maxLength={LIMITS.maxNameLength}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint={i === names.length - 1 ? 'done' : 'next'}
                aria-label={i === 0 ? 'Your name' : `Player ${i + 1} name`}
                onChange={(e) => update(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && i === names.length - 1 && cleanName(name)) add();
                }}
              />
              {names.length > 1 && (
                <button
                  type="button"
                  className="icon-btn press"
                  aria-label={`Remove ${name || `player ${i + 1}`}`}
                  onClick={() => remove(i)}
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          ))}
        </div>
        {names.length < LIMITS.maxPlayers && (
          <button type="button" className="btn btn-outline" onClick={add}>
            <PlusIcon width={24} height={24} /> Add player
          </button>
        )}
      </div>
      <div className="screen-foot">
        <button type="button" className="btn btn-xl btn-green" disabled={!valid} onClick={() => navigate({ name: 'setupCourse' })}>
          Next
        </button>
      </div>
    </div>
  );
}
