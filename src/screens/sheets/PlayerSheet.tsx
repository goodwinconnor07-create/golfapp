import { useState } from 'react';
import { cleanName, LIMITS, newId } from '../../game';
import { closeSheet, confirm, dispatch, setProfileLook, useApp } from '../../state/store';
import { isHost } from '../../state/view';
import { Avatar, LookPicker, Sheet } from '../../ui/components';

/** Your own player: name and picture. Host: also add a guest, rename someone, take over a dead phone's player, or remove someone. */
export function PlayerSheet({ playerId }: { playerId: string }) {
  const game = useApp((s) => s.game);
  const deviceId = useApp((s) => s.deviceId);
  const online = useApp((s) => s.session?.mode === 'online');
  const player = game?.players.find((p) => p.id === playerId);
  const isNew = playerId === 'new';
  const [name, setName] = useState(player?.name ?? '');
  const taken = (game?.players ?? []).filter((p) => p.id !== playerId).map((p) => p.color);
  const firstFree = [0, 1, 2, 3, 4, 5, 6, 7].find((c) => !taken.includes(c)) ?? 0;
  const [look, setLook] = useState({ emoji: player?.emoji ?? null, color: player?.color ?? firstFree });
  if (!game || (!isNew && !player)) return null;
  const host = isHost(game, deviceId);
  const mine = player?.deviceId === deviceId;

  const save = () => {
    if (isNew) {
      if (dispatch({ type: 'addPlayer', id: newId(12), name, color: look.color, ...(look.emoji ? { emoji: look.emoji } : {}) })) closeSheet();
      return;
    }
    if (!player) return;
    let ok = name.trim() === player.name || dispatch({ type: 'renamePlayer', playerId, name });
    if (ok && (look.emoji !== (player.emoji ?? null) || look.color !== player.color)) {
      ok = dispatch({ type: 'setLook', playerId, emoji: look.emoji, color: look.color });
      if (ok && mine) setProfileLook(look);
    }
    if (ok) closeSheet();
  };

  return (
    <Sheet title={isNew ? 'Add a player' : 'Player'}>
      <div className="stack">
        <div className="name-row">
          <Avatar player={{ name: cleanName(name) || '?', color: look.color, emoji: look.emoji ?? undefined }} size={52} />
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
        <LookPicker name={name} emoji={look.emoji} color={look.color} taken={taken} onChange={setLook} />
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
