import type { ComponentType, SVGProps } from 'react';
import {
  closeSheet,
  confirm,
  dispatch,
  getState,
  leaveGame,
  navigate,
  openSheet,
  resetTo,
  useApp,
  type Sheet as SheetSpec,
} from '../../state/store';
import { isHost } from '../../state/view';
import { Sheet } from '../../ui/components';
import { ExitIcon, FlagIcon, GearIcon, HelpIcon, HomeIcon, ListIcon, TrophyIcon, UsersIcon } from '../../ui/Icons';
import { EditSheet } from './EditSheet';
import { InviteSheet } from './InviteSheet';
import { OptionsSheet, ParsSheet } from './OptionsSheet';
import { LookSheet } from './LookSheet';
import { NotificationsSheet } from './NotificationsSheet';
import { PlayerSheet } from './PlayerSheet';
import { StandingsSheet } from './StandingsSheet';

export function SheetHost({ sheet }: { sheet: SheetSpec }) {
  switch (sheet.name) {
    case 'invite':
      return <InviteSheet />;
    case 'options':
      return <OptionsSheet />;
    case 'pars':
      return <ParsSheet />;
    case 'menu':
      return <MenuSheet />;
    case 'notifications':
      return <NotificationsSheet />;
    case 'standings':
      return <StandingsSheet />;
    case 'look':
      return <LookSheet typed={sheet.typed} />;
    case 'player':
      return <PlayerSheet playerId={sheet.playerId} />;
    case 'edit':
      return <EditSheet playerId={sheet.playerId} hole={sheet.hole} />;
    case 'confirm':
      return <ConfirmSheet sheet={sheet} />;
  }
}

function ConfirmSheet({ sheet }: { sheet: Extract<SheetSpec, { name: 'confirm' }> }) {
  const run = () => {
    sheet.onConfirm();
    // Most confirms move to another screen, which closes the sheet anyway.
    if (getState().sheet === sheet) closeSheet();
  };
  return (
    <Sheet title={sheet.title}>
      {sheet.body && (
        <p className="muted" style={{ marginTop: 0 }}>
          {sheet.body}
        </p>
      )}
      <div className="stack">
        <button type="button" className={`btn btn-xl ${sheet.danger ? 'btn-red' : 'btn-green'}`} onClick={run}>
          {sheet.confirm}
        </button>
        <button type="button" className="btn btn-ghost" onClick={closeSheet}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}

interface Item {
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
  onClick: () => void;
  danger?: boolean;
}

function MenuSheet() {
  const game = useApp((s) => s.game);
  const deviceId = useApp((s) => s.deviceId);
  const online = useApp((s) => s.session?.mode === 'online');
  if (!game) return null;
  const host = isHost(game, deviceId);
  const started = game.status !== 'lobby';

  const items: Item[] = [];
  if (started) {
    items.push({ label: 'Standings', Icon: TrophyIcon, color: 'var(--gold)', onClick: () => openSheet({ name: 'standings' }) });
    items.push({ label: 'Scorecard & fixes', Icon: ListIcon, color: 'var(--blue)', onClick: () => navigate({ name: 'scorecard' }) });
  }
  if (host || online)
    items.push({
      label: online ? 'Invite code' : 'Invite friends',
      Icon: UsersIcon,
      color: 'var(--green)',
      onClick: () => openSheet({ name: 'invite' }),
    });
  items.push({ label: 'Game options', Icon: GearIcon, color: 'var(--slate-hi)', onClick: () => openSheet({ name: 'options' }) });
  items.push({ label: 'How to play', Icon: HelpIcon, color: 'var(--insane)', onClick: () => navigate({ name: 'howto' }) });
  items.push({ label: 'Home', Icon: HomeIcon, color: 'var(--safe)', onClick: () => resetTo() });
  if (host && game.status === 'playing') {
    items.push({
      label: 'End round now',
      Icon: FlagIcon,
      color: 'var(--red)',
      danger: true,
      onClick: () =>
        confirm({
          title: 'End the round now?',
          body: 'Only finished holes count. You can still fix scores afterwards.',
          confirm: 'End round',
          danger: true,
          onConfirm: () => dispatch({ type: 'finish' }),
        }),
    });
  }
  if (online && !host) {
    items.push({
      label: 'Leave game',
      Icon: ExitIcon,
      color: 'var(--red)',
      danger: true,
      onClick: () =>
        confirm({
          title: 'Leave this game?',
          body: 'The host can finish your scores for you.',
          confirm: 'Leave',
          danger: true,
          onConfirm: leaveGame,
        }),
    });
  }

  return (
    <Sheet title="Menu">
      {items.map(({ label, Icon, color, onClick, danger }) => (
        <button key={label} type="button" className={`menu-item press ${danger ? 'danger' : ''}`} onClick={onClick}>
          <span className="mi-icon" style={{ background: color }}>
            <Icon />
          </span>
          {label}
        </button>
      ))}
    </Sheet>
  );
}
