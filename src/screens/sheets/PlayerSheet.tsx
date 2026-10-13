import { useState } from 'react';
import { cleanName, LIMITS, newId } from '../../game';
import { closeSheet, confirm, dispatch, useApp } from '../../state/store';
import { isHost } from '../../state/view';
import { Avatar, Sheet } from '../../ui/components';

/** Host only: add a guest, rename someone, take over a dead phone's player, or remove someone. */
export function PlayerSheet({ playerId }: { playerId: string }) {
  const game = useApp((s) => s.game);
  const deviceId = useApp((s) => s.deviceId);
  const online = useApp((s) => s.session?.mode === 'online');
  const player = game?.players.find((p) => p.id === playerId);
  const isNew = playerId === 'new';
  const [name, setName] = useState(player?.name ?? '');
  if (!game || (!isNew && !player)) return null;
  const host = isHost(game, deviceId);

  const save = () => {
    const ok = isNew ? dispatch({ type: 'addPlayer', id: newId(12), name }) : dispatch({ type: 'renamePlayer', playerId, name });
    if (ok) closeSheet();
  };

  return (
    <Sheet title={isNew ? 'Add a player' : 'Player'}>
      <div className="stack">
        <div className="name-row">
          <Avatar player={{ name: cleanName(name) || '?', color: player?.color ?? game.players.length }} size={52} />
          <input
            className="field"
            value={name}
            autoFocus={isNew}
            placeholder="Name"
            maxLength={LIMITS.maxNameLength}
            autoCapitalize="words"
            autoComplete="off"
            aria-label="Name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && cleanName(name)) save();
            }}
          />
        </div>
        <button type="button" className="btn btn-green" disabled={!cleanName(name)} onClick={save}>
          {isNew ? 'Add' : 'Save'}
        </button>
        {!isNew && player && host && online && player.deviceId && player.deviceId !== deviceId && (
          <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'releasePlayer', playerId }) && closeSheet()}>
            Run {player.name} from my phone
          </button>
        )}
        {!isNew && player && host && game.players.length > 1 && (
          <button
            type="button"
            className="btn btn-ghost bad"
            onClick={() =>
              confirm({
                title: `Remove ${player.name}?`,
                body: 'Their scores for this round will be deleted.',
                confirm: 'Remove',
                danger: true,
                onConfirm: () => dispatch({ type: 'removePlayer', playerId }),
              })
            }
          >
            Remove from game
          </button>
        )}
      </div>
    </Sheet>
  );
}
