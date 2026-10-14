import { FixList } from '../game/FixPrompt';
import { useApp } from '../../state/store';
import { Sheet } from '../../ui/components';

export function NotificationsSheet() {
  const game = useApp((s) => s.game);
  if (!game) return null;
  return (
    <Sheet title="Notifications">
      <FixList game={game} />
    </Sheet>
  );
}
