import { useEffect, useRef } from 'react';
import { isNameBlocked, LIMITS, NAME_BLOCKED } from '../../game';
import { closeSheet, getState, setDraftNames, setProfileLook, useApp } from '../../state/store';
import { Avatar, LookPicker, Sheet } from '../../ui/components';

/**
 * Your picture for new and joined games: a big live preview, then emoji and colour. Changes save as you tap.
 * With `editName` (the new game screen) your name is typed here too.
 */
export function LookSheet({ typed, editName = false }: { typed?: string; editName?: boolean }) {
  const look = useApp((s) => s.profileLook);
  const draftName = useApp((s) => s.draft.names[0] ?? '');
  const stored = useApp((s) => s.draft.names[0] || s.profileName || '?');
  const name = editName ? draftName : typed?.trim() ? typed : stored;
  const input = useRef<HTMLInputElement>(null);
  // No name yet: start in the name box. After the sheet's own focus, hence the timeout.
  useEffect(() => {
    if (!editName || draftName.trim()) return;
    const t = setTimeout(() => input.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);
  return (
    <Sheet title={editName ? 'You' : 'Your picture'}>
      {editName && (
        <div className="look-name">
          <input
            ref={input}
            className="field"
            value={draftName}
            placeholder="Type your name"
            maxLength={LIMITS.maxNameLength}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="done"
            aria-label="Your name"
            // Anyone after the host came from "Play again" and stays on the list.
            onChange={(e) => setDraftNames([e.target.value, ...getState().draft.names.slice(1)])}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
          {isNameBlocked(draftName) && (
            <p className="field-error" role="alert" style={{ margin: 0 }}>
              {NAME_BLOCKED}
            </p>
          )}
        </div>
      )}
      <div className="look-preview">
        {/* Keyed on the look so each change pops. */}
        <span key={`${look.emoji}-${look.color}`} className="pop">
          <Avatar player={{ name, color: look.color, emoji: look.emoji ?? undefined }} size={96} />
        </span>
        {!editName && <b className="look-preview-name">{name.trim() || 'You'}</b>}
      </div>
      <LookPicker name={name} emoji={look.emoji} color={look.color} onChange={setProfileLook} />
      <button type="button" className="btn btn-green" style={{ marginTop: 20 }} onClick={closeSheet}>
        Done
      </button>
    </Sheet>
  );
}
