import { useEffect, useRef, useState } from 'react';
import { cleanName, CODE_LENGTH, freeColor, isNameBlocked, normalizeCode, type GameInfo } from '../game';
import { fetchGameInfo } from '../state/api';
import { confirm, joinGame, navigate, openSheet, resetTo, setDraftNames, useApp } from '../state/store';
import { haptic } from '../ui/effects';
import { Avatar, BackBar, Blobs, NameAndPicture, TierIcon } from '../ui/components';

/**
 * Step 1: type (or arrive with) the 5-letter code. `home`: the website's Home, which is this
 * screen with How to play in the corner and no footer.
 */
export function Join({ initialCode, home = false }: { initialCode?: string; home?: boolean }) {
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
    <div className={`screen${home ? ' join-home' : ''}`}>
      {home ? (
        <>
          <Blobs />
          <div className="join-home-top">
            <button type="button" className="home-pill press" onClick={() => navigate({ name: 'howto' })}>
              How to play
            </button>
          </div>
        </>
      ) : (
        <BackBar title="Join a game" />
      )}
      <div className="screen-body">
        {home ? (
          <div className="join-home-hero">
            <p className="join-home-brand">CardShot</p>
            <h1>Join the game</h1>
            <p>Get the 5-letter code from the host, or scan their QR code.</p>
          </div>
        ) : (
          <>
            <h1 className="h1">Enter the code</h1>
            <p className="muted" style={{ margin: 0 }}>
              Get the 5-letter code from whoever started the game, or scan their QR code.
            </p>
          </>
        )}
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
            autoFocus={!initialCode && !home}
          />
        </div>
        {error && (
          <p className="bad shake" role="alert" style={{ margin: 0, textAlign: 'center' }}>
            {error}
          </p>
        )}
        {server === 'down' && <p className="note">Can't reach the server right now. Check your signal.</p>}
        {/* The website has no button: the code is looked up as soon as all 5 letters are in. */}
        {home && busy && <span className="spinner join-home-busy" aria-label="Looking for the game" />}
        {/* A friend arriving here may never have heard of the game: one line on what it is. */}
        {home && !busy && (
          <p className="join-home-about">
            <span className="how-step-icons" aria-hidden>
              <TierIcon tier="safe" size={18} />
              <TierIcon tier="bold" size={18} />
              <TierIcon tier="insane" size={18} />
            </span>
            A golf party game: before each hole, pick Safe, Bold or Insane and play the card you get.
          </p>
        )}
      </div>
      {!home && (
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
      )}
    </div>
  );
}

/** Step 2: tap your name, or add yourself. */
export function JoinWho({ info }: { info: GameInfo }) {
  const profileName = useApp((s) => s.profileName);
  // The name lives in the draft so the picture sheet can edit it too. It starts as the remembered name.
  const name = useApp((s) => s.draft.names[0] ?? '');
  useEffect(() => {
    setDraftNames([profileName]);
  }, []);
  const look = useApp((s) => s.profileLook);
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

        {info.players.length > 0 && (
          <>
            <p className="section-title">{free.length > 0 ? 'Tap your name' : 'Already playing'}</p>
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
          </>
        )}

        {info.canJoinAsNew ? (
          <>
            {info.players.length > 0 && <p className="section-title">{free.length > 0 ? 'Not on the list?' : 'Your name and picture'}</p>}
            {/* The colour you'll actually get: someone already in the game may have your usual one. */}
            <NameAndPicture
              name={name}
              look={{ ...look, color: freeColor(info.players, look.color) }}
              onName={(value) => setDraftNames([value])}
              onPicture={() => openSheet({ name: 'look', typed: name })}
              onDone={() => cleanName(name) && !isNameBlocked(name) && joinGame(info, { name })}
            />
          </>
        ) : (
          free.length === 0 && (
            <p className="tile-flat" style={{ margin: 0 }}>
              This round is already under way, so new players can't join. Ask the host to enter your scores.
            </p>
          )
        )}
      </div>
      {info.canJoinAsNew && (
        <div className="screen-foot">
          <button
            type="button"
            className="btn btn-xl btn-blue"
            disabled={!cleanName(name) || isNameBlocked(name)}
            onClick={() => joinGame(info, { name })}
          >
            {cleanName(name) ? `Join as ${cleanName(name)}` : 'Type your name to join'}
          </button>
        </div>
      )}
    </div>
  );
}
