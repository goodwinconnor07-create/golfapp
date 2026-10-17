import { useRef, useState } from 'react';
import type { Game, Player } from '../../game';
import { dispatch } from '../../state/store';
import { Avatar } from '../../ui/components';

type Pairs = [[string, string], [string, string]];

/** The host's 2v2 setup: drag a profile pic onto someone on the other team to swap them. A tap on two pics swaps too. */
export function TeamPicker({ game, editable }: { game: Game; editable: boolean }) {
  const teams = game.teams;
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  if (!teams) return null;

  const pairs: Pairs = [[...teams[0].players], [...teams[1].players]];
  const byId = (id: string): Player | undefined => game.players.find((p) => p.id === id);

  const swap = (a: string, b: string) => {
    if (a === b) return;
    const next = pairs.map((t) => t.map((id) => (id === a ? b : id === b ? a : id))) as Pairs;
    dispatch({ type: 'setTeams', teams: next });
  };
  const sideOf = (id: string) => (pairs[0].includes(id) ? 0 : 1);

  const dropTarget = (x: number, y: number, from: string): string | null => {
    // The pic being dragged sits under the finger, so look through it.
    const hit = document.elementsFromPoint(x, y).map((n) => n.closest<HTMLElement>('[data-team-pid]')).find((n) => n && n.dataset.teamPid !== from);
    const id = hit?.dataset.teamPid;
    return id && id !== from && sideOf(id) !== sideOf(from) ? id : null;
  };

  const down = (e: React.PointerEvent, id: string) => {
    if (!editable) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, moved: false };
    setDrag({ id, x: 0, y: 0 });
  };
  const move = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || !drag) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) + Math.abs(dy) > 8) s.moved = true;
    setDrag({ id: drag.id, x: dx, y: dy });
  };
  const up = (e: React.PointerEvent, id: string) => {
    const s = start.current;
    start.current = null;
    setDrag(null);
    if (!s) return;
    if (s.moved) {
      setPicked(null);
      const target = dropTarget(e.clientX, e.clientY, id);
      if (target) swap(id, target);
      return;
    }
    // A plain tap: pick one, then tap someone on the other team to swap.
    if (!picked || picked === id) return setPicked(picked === id ? null : id);
    if (sideOf(picked) !== sideOf(id)) swap(picked, id);
    setPicked(null);
  };

  const chip = (id: string) => {
    const p = byId(id);
    if (!p) return null;
    const dragging = drag?.id === id;
    return (
      <div
        key={id}
        data-team-pid={id}
        className={`team-chip${dragging ? ' dragging' : ''}${picked === id ? ' picked' : ''}${editable ? ' can-drag' : ''}`}
        style={dragging ? { transform: `translate(${drag.x}px, ${drag.y}px) scale(1.08)` } : undefined}
        onPointerDown={(e) => down(e, id)}
        onPointerMove={move}
        onPointerUp={(e) => up(e, id)}
        onPointerCancel={() => {
          start.current = null;
          setDrag(null);
        }}
      >
        <Avatar player={p} size={56} />
        <span className="name">{p.name}</span>
      </div>
    );
  };

  return (
    <div className="team-picker" data-testid="team-picker">
      {pairs.map((t, i) => (
        <div key={i} className={`team-box team-box-${i + 1}`} data-testid={`team-${i + 1}`}>
          <p className="label">Team {i + 1}</p>
          <div className="team-members">{t.map(chip)}</div>
        </div>
      ))}
      {editable && <p className="muted team-hint">Drag a pic onto someone on the other team to swap, or tap two.</p>}
    </div>
  );
}
