import { useEffect, useRef, useState } from 'react';
import { cleanName, CODE_LENGTH, LIMITS, normalizeCode, type GameInfo } from '../game';
import { fetchGameInfo } from '../state/api';
import { confirm, joinGame, navigate, resetTo, useApp } from '../state/store';
import { haptic } from '../ui/effects';
import { Avatar, BackBar } from '../ui/components';

/** Step 1: type (or arrive with) the 5-letter code. */
export function Join({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(normalizeCode(initialCode ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const server = useApp((s) => s.server);
  const session = useApp((s) => s.session);
  const looked = useRef('');

  const lookUp = async (value: string) => {
    if (value.length !== CODE_LENGTH || busy || looked.current === value) return;
    looked.current = value;
    if (session?.mode === 'online' && session.code === value) {
      resetTo({ name: 'game' });
      return;
    }
    setBusy(true);
    setError('');
    try {
      const info = await fetchGameInfo(value);
      if (!info) {
        setError("There's no game with that code. Check it and try again.");
        haptic('error');
        return;
      }
      navigate({ name: 'joinWho', info });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      haptic('error');
    } finally {
      looked.current = '';
      setBusy(false);
    }
  };

  // Arriving from a join link: look the code up straight away (once).
  useEffect(() => {
    if (code.length === CODE_LENGTH) void lookUp(code);
  }, []);

  return (
    <div className="screen">
      <BackBar title="Join a game" />
      <div className="screen-body">
        <h1 className="h1">Enter the code</h1>
        <p className="muted" style={{ margin: 0 }}>
          Get the 5-letter code from whoever started the game, or scan their QR code.
        </p>
        <div className="code-input">
          <input
            value={code}
            onChange={(e) => {
              const next = normalizeCode(e.target.value);
              setCode(next);
              setError('');
              if (next.length === CODE_LENGTH) void lookUp(next);
            }}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={10}
            placeholder="CODE"
            aria-label="Game code"
            autoFocus={!initialCode}
          />
        </div>
        {error && (
          <p className="bad shake" role="alert" style={{ margin: 0, textAlign: 'center' }}>
            {error}
          </p>
        )}
        {server === 'down' && <p className="note">Can't reach the server right now. Check your signal.</p>}
      </div>
      <div className="screen-foot">
        <button
          type="button"
          className="btn btn-xl btn-blue"
          disabled={code.length !== CODE_LENGTH || busy}
          onClick={() => void lookUp(code)}
        >
          {busy ? <span className="spinner" aria-label="Looking for the game" /> : 'Find game'}
        </button>
      </div>
    </div>
  );
}

/** Step 2: tap your name, or add yourself. */
export function JoinWho({ info }: { info: GameInfo }) {
  const profileName = useApp((s) => s.profileName);
  const [name, setName] = useState(profileName);
  const free = info.players.filter((p) => !p.claimed);
  const taken = info.players.filter((p) => p.claimed);

  return (
    <div className="screen">
      <BackBar title={`Code ${info.code}`} />
      <div className="screen-body">
        <h1 className="h1">Who are you?</h1>
        <p className="muted" style={{ margin: 0 }}>
          {info.hostName ? `${info.hostName}'s game` : 'Online game'} · {info.holes} hole{info.holes === 1 ? '' : 's'}
          {info.course ? ` · ${info.course}` : ''}
          {info.status === 'finished' ? ' · finished' : ''}
        </p>

        <div className="stack">
          {free.map((p) => (
            <button key={p.id} type="button" className="player-row press" onClick={() => joinGame(info, { playerId: p.id })}>
              <Avatar player={p} size={48} />
              <span className="name">{p.name}</span>
              <span className="tag tag-you">That's me</span>
            </button>
          ))}
          {taken.map((p) => (
            <button
              key={p.id}
              type="button"
              className="player-row press"
              onClick={() =>
                confirm({
                  title: `Are you ${p.name}?`,
                  body: `${p.name} is already playing on another phone. Joining moves them to this one.`,
                  confirm: `I'm ${p.name}`,
                  onConfirm: () => joinGame(info, { playerId: p.id }),
                })
              }
            >
              <Avatar player={p} size={48} />
              <span className="name">{p.name}</span>
              <span className="tag tag-joined">On a phone</span>
            </button>
          ))}
        </div>

        {info.canJoinAsNew ? (
          <div className="tile stack">
            <h2 className="h3">{info.players.length ? 'Not on the list?' : 'Your name'}</h2>
            <input
              className="field"
              value={name}
              placeholder="Your name"
              maxLength={LIMITS.maxNameLength}
              autoCapitalize="words"
              autoComplete="off"
              aria-label="Your name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && cleanName(name)) joinGame(info, { name });
              }}
            />
            <button type="button" className="btn btn-blue" disabled={!cleanName(name)} onClick={() => joinGame(info, { name })}>
              Join as {cleanName(name) || 'me'}
            </button>
          </div>
        ) : (
          free.length === 0 && (
            <p className="tile-flat" style={{ margin: 0 }}>
              This round is already under way, so new players can't join. Ask the host to enter your scores.
            </p>
          )
        )}
      </div>
    </div>
  );
}
