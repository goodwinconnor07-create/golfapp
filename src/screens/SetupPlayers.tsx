import { useState } from 'react';
import { cleanName, LIMITS } from '../game';
import { navigate, setDraftNames, setProfileLook, useApp } from '../state/store';
import { Avatar, BackBar, LookPicker } from '../ui/components';

/** Setup step 1: just the host's name. Everyone else joins from their own phone with the code. */
export function SetupPlayers() {
  const name = useApp((s) => s.draft.names[0] ?? '');
  const valid = Boolean(cleanName(name));
  const look = useApp((s) => s.profileLook);
  const [picking, setPicking] = useState(false);
  const next = () => {
    // Older drafts could hold other players' names: only the host's carries on.
    setDraftNames([name]);
    navigate({ name: 'setupCourse' });
  };

  return (
    <div className="screen">
      <BackBar title="New game" />
      <div className="screen-body">
        <h1 className="h1">What's your name?</h1>
        <p className="muted" style={{ margin: 0 }}>
          Next you'll get a code. Your group joins on their own phones and picks their own cards.
        </p>
        <div className="name-row">
          <button
            type="button"
            className="avatar-button press"
            aria-label="Change your picture"
            aria-expanded={picking}
            onClick={() => setPicking((v) => !v)}
          >
            <Avatar player={{ name: name || '?', color: look.color, emoji: look.emoji ?? undefined }} size={50} />
            <span className="avatar-edit" aria-hidden>
              ✎
            </span>
          </button>
          <input
            className="field"
            value={name}
            placeholder="Your name"
            maxLength={LIMITS.maxNameLength}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            aria-label="Your name"
            onChange={(e) => setDraftNames([e.target.value])}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid) next();
            }}
          />
        </div>
        {picking ? (
          <LookPicker name={name} emoji={look.emoji} color={look.color} onChange={setProfileLook} />
        ) : (
          <button type="button" className="btn-link-small" style={{ alignSelf: 'flex-start' }} onClick={() => setPicking(true)}>
            Pick a picture
          </button>
        )}
      </div>
      <div className="screen-foot">
        <button type="button" className="btn btn-xl btn-green" disabled={!valid} onClick={next}>
          Next
        </button>
      </div>
    </div>
  );
}
