import { cleanName, isNameBlocked, LIMITS, NAME_BLOCKED } from '../game';
import { navigate, openSheet, setDraftNames, useApp } from '../state/store';
import { Avatar, BackBar } from '../ui/components';

/** Setup step 1: just the host's name. Everyone else joins from their own phone with the code. */
export function SetupPlayers() {
  const name = useApp((s) => s.draft.names[0] ?? '');
  const blocked = isNameBlocked(name);
  const valid = Boolean(cleanName(name)) && !blocked;
  const look = useApp((s) => s.profileLook);
  const initial = [...name.trim()][0]?.toUpperCase() ?? '?';
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
        {/* Your picture, big. It pops whenever the letter, emoji or colour changes, then floats. */}
        <div className="hero-pic">
          <button
            type="button"
            className="avatar-button hero-button"
            aria-label="Change your picture"
            onClick={() => openSheet({ name: 'look' })}
          >
            <span key={`${look.emoji ?? initial}-${look.color}`} className="hero-pop">
              <span className="hero-float">
                <Avatar player={{ name: name || '?', color: look.color, emoji: look.emoji ?? undefined }} size={152} />
              </span>
            </span>
          </button>
          <button type="button" className="btn-link-small" onClick={() => openSheet({ name: 'look' })}>
            {look.emoji ? 'Change your picture' : 'Pick a picture'}
          </button>
        </div>
      </div>
      <div className="screen-foot">
        <input
          className="field"
          value={name}
          placeholder="Type your name"
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
        {blocked && (
          <p className="field-error" role="alert" style={{ margin: 0 }}>
            {NAME_BLOCKED}
          </p>
        )}
        <button type="button" className="btn btn-xl btn-green" disabled={!valid} onClick={next}>
          Next
        </button>
      </div>
    </div>
  );
}
