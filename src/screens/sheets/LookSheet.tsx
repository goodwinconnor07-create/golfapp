import { closeSheet, setProfileLook, useApp } from '../../state/store';
import { Avatar, LookPicker, Sheet } from '../../ui/components';

/** Your picture for new and joined games: a big live preview, then emoji and colour. Changes save as you tap. */
export function LookSheet({ typed }: { typed?: string }) {
  const look = useApp((s) => s.profileLook);
  const stored = useApp((s) => s.draft.names[0] || s.profileName || '?');
  const name = typed?.trim() ? typed : stored;
  return (
    <Sheet title="Your picture">
      <div className="look-preview">
        {/* Keyed on the look so each change pops. */}
        <span key={`${look.emoji}-${look.color}`} className="pop">
          <Avatar player={{ name, color: look.color, emoji: look.emoji ?? undefined }} size={96} />
        </span>
        <b className="look-preview-name">{name.trim() || 'You'}</b>
      </div>
      <LookPicker name={name} emoji={look.emoji} color={look.color} onChange={setProfileLook} />
      <button type="button" className="btn btn-green" style={{ marginTop: 20 }} onClick={closeSheet}>
        Done
      </button>
    </Sheet>
  );
}
