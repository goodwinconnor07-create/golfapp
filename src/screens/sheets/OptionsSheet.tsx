import { ALL_PACKS, anyPicked, DEFAULT_PACKS, isV2, PACK_INFO, type PackId, type Par, type Settings } from '../../game';
import { closeSheet, dispatch, openSheet, useApp } from '../../state/store';
import { isHost } from '../../state/view';
import { Sheet, Toggle } from '../../ui/components';

export function OptionsSheet() {
  const game = useApp((s) => s.game);
  const deviceId = useApp((s) => s.deviceId);
  if (!game) return null;
  const host = isHost(game, deviceId);
  const hostName = game.players.find((p) => p.deviceId === game.hostDeviceId)?.name ?? 'the host';

  const set = (settings: Partial<Settings>) => dispatch({ type: 'setSettings', settings });

  return (
    // The course is picked at the start (New game → Where are you playing?), so it isn't here.
    <Sheet title="Game options" onClose={closeSheet}>
      {!host && (
        <p className="note" style={{ marginTop: 0 }}>
          Only {hostName} can change these.
        </p>
      )}
      <div style={{ marginTop: 8 }}>
        <Toggle
          on={game.settings.distanceCards}
          disabled={!host}
          title="Distance cards"
          detail="Cards like “within 15 feet”. The group votes on them."
          onChange={(v) => set({ distanceCards: v })}
        />
        {/* Situation cards are all retired in deck v2 (docs/GAME_BALANCE.md), so their option is hidden. */}
        <Toggle
          on={game.settings.tiebreakOnStrokes}
          disabled={!host}
          title="Break ties on real strokes"
          detail="Fewer strokes wins a tie."
          onChange={(v) => set({ tiebreakOnStrokes: v })}
        />
        <Toggle
          on={game.settings.mulligans}
          disabled={!host || game.status !== 'lobby'}
          title="Mulligans"
          detail={
            game.status === 'lobby'
              ? `${game.holes.length <= 9 ? '2' : '4'} re-hits each that don't count.`
              : `Set before the round: ${game.settings.mulligans ? `${game.holes.length <= 9 ? '2' : '4'} each` : 'off'}.`
          }
          onChange={(v) => set({ mulligans: v })}
        />
      </div>
      {isV2(game) && <ShowdownOptions host={host} />}
      <div className="stack" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-ghost" onClick={() => openSheet({ name: 'pars' })}>
          Set pars
        </button>
        <button type="button" className="btn btn-dark" onClick={closeSheet}>
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
        Leave any blank and you'll be asked on the tee.
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

/** Ruleset 2: the Crown and the card packs. Set before the round, then fixed. */
function ShowdownOptions({ host }: { host: boolean }) {
  const game = useApp((s) => s.game);
  if (!game) return null;
  const lobby = game.status === 'lobby';
  const packs = game.settings.packs ?? DEFAULT_PACKS;
  const setPack = (pack: PackId, on: boolean) =>
    dispatch({ type: 'setSettings', settings: { packs: on ? [...packs, pack] : packs.filter((p) => p !== pack) } });
  return (
    <div style={{ marginTop: 8 }}>
      <Toggle
        on={game.settings.crown !== false}
        disabled={!host || !lobby}
        title="👑 The Crown"
        detail="Beat the leader's score on a hole and take a stroke off."
        onChange={(v) => dispatch({ type: 'setSettings', settings: { crown: v } })}
      />
      <p className="section-title" style={{ margin: '16px 0 4px' }}>
        Card packs{lobby ? '' : ' · set before the round'}
      </p>
      {ALL_PACKS.map((pack) => (
        <Toggle
          key={pack}
          on={pack === 'core' || packs.includes(pack)}
          disabled={!host || !lobby || pack === 'core'}
          title={PACK_INFO[pack].label}
          detail={PACK_INFO[pack].blurb}
          onChange={(v) => setPack(pack, v)}
        />
      ))}
    </div>
  );
}
