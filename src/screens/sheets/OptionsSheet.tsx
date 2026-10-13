import { useState } from 'react';
import { anyPicked, LIMITS, type Par, type Settings } from '../../game';
import { closeSheet, dispatch, openSheet, useApp } from '../../state/store';
import { isHost } from '../../state/view';
import { Sheet, Toggle } from '../../ui/components';

export function OptionsSheet() {
  const game = useApp((s) => s.game);
  const deviceId = useApp((s) => s.deviceId);
  const [course, setCourse] = useState(game?.course ?? '');
  if (!game) return null;
  const host = isHost(game, deviceId);
  const hostName = game.players.find((p) => p.deviceId === game.hostDeviceId)?.name ?? 'the host';

  const saveCourse = () => {
    if (host && course.trim() !== game.course) dispatch({ type: 'setCourse', course });
  };
  const set = (settings: Partial<Settings>) => dispatch({ type: 'setSettings', settings });

  return (
    <Sheet
      title="Game options"
      onClose={() => {
        saveCourse();
        closeSheet();
      }}
    >
      {!host && (
        <p className="note" style={{ marginTop: 0 }}>
          Only {hostName} can change these.
        </p>
      )}
      <label className="label" htmlFor="course">
        Course name (optional)
      </label>
      <input
        id="course"
        className="field"
        style={{ marginTop: 8 }}
        value={course}
        placeholder="Where are you playing?"
        maxLength={LIMITS.maxCourseLength}
        disabled={!host}
        onChange={(e) => setCourse(e.target.value)}
        onBlur={saveCourse}
      />
      <div style={{ marginTop: 8 }}>
        <Toggle
          on={game.settings.distanceCards}
          disabled={!host}
          title="Distance cards"
          detail="Cards like “within 15 feet”. Judged by eye or pacing, honour system."
          onChange={(v) => set({ distanceCards: v })}
        />
        <Toggle
          on={game.settings.situationCards}
          disabled={!host}
          title="Situation cards"
          detail="Cards that only count if something happens, like landing in a bunker. If it doesn't happen, no change."
          onChange={(v) => set({ situationCards: v })}
        />
        <Toggle
          on={game.settings.tiebreakOnStrokes}
          disabled={!host}
          title="Break ties on real strokes"
          detail="Off: equal game scores share the place."
          onChange={(v) => set({ tiebreakOnStrokes: v })}
        />
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-ghost" onClick={() => openSheet({ name: 'pars' })}>
          Set pars
        </button>
        <button
          type="button"
          className="btn btn-dark"
          onClick={() => {
            saveCourse();
            closeSheet();
          }}
        >
          Done
        </button>
      </div>
    </Sheet>
  );
}

export function ParsSheet() {
  const game = useApp((s) => s.game);
  const deviceId = useApp((s) => s.deviceId);
  if (!game) return null;
  const host = isHost(game, deviceId);

  return (
    <Sheet title="Pars">
      <p className="note" style={{ marginTop: 0, textAlign: 'left' }}>
        Set them now or leave them: the app asks on each tee if a par is missing.
      </p>
      {game.holes.map((hole, i) => {
        const locked = !host && anyPicked(game, i);
        return (
          <div key={i} className="par-row">
            <span className="hole-no">Hole {hole.number}</span>
            <div className="par-seg" role="radiogroup" aria-label={`Par for hole ${hole.number}`}>
              {([3, 4, 5] as Par[]).map((par) => (
                <button
                  key={par}
                  type="button"
                  role="radio"
                  aria-checked={hole.par === par}
                  className={`press ${hole.par === par ? 'on' : ''}`}
                  disabled={locked}
                  onClick={() => dispatch({ type: 'setPar', hole: i, par })}
                >
                  {par}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <button type="button" className="btn btn-dark" style={{ marginTop: 12 }} onClick={closeSheet}>
        Done
      </button>
    </Sheet>
  );
}
