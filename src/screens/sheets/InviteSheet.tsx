import { useEffect, useRef } from 'react';
import { goOnline, toast, useApp } from '../../state/store';
import { Sheet, Spinner } from '../../ui/components';
import { CopyIcon, ShareIcon } from '../../ui/Icons';
import { QRCode } from '../../ui/QRCode';

const TILE_COLORS = ['#f97316', '#ec4899', '#8b5cf6', '#2563eb', '#14b8a6'];

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Link copied', 'success');
  } catch {
    toast("Couldn't copy. Read the code out instead.", 'error');
  }
}

export function InviteSheet() {
  const game = useApp((s) => s.game);
  const online = useApp((s) => s.session?.mode === 'online');
  const server = useApp((s) => s.server);
  const busy = useApp((s) => s.busy);
  const tried = useRef(false);

  // Opening the invite is the "go online" moment: upload the game and get a code.
  useEffect(() => {
    if (!online && !tried.current && server !== 'down') {
      tried.current = true;
      void goOnline();
    }
  }, [online, server]);

  if (!game) return null;

  if (!online || !game.code) {
    return (
      <Sheet title="Invite friends">
        {busy ? (
          <Spinner label={busy} />
        ) : (
          <div className="stack">
            <p style={{ marginTop: 0 }}>
              {server === 'down'
                ? "Online play isn't switched on yet. Once it is, friends can join this game with a code."
                : "Couldn't get a code just now. Check your signal and try again."}
            </p>
            <button type="button" className="btn btn-blue" onClick={() => void goOnline()}>
              Try again
            </button>
            <p className="note">You can still play everyone on this phone.</p>
          </div>
        )}
      </Sheet>
    );
  }

  const link = `${location.origin}/j/${game.code}`;
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my Send It game', text: `Join my golf game on Send It. Code: ${game.code}`, url: link });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    await copy(link);
  };

  return (
    <Sheet title="Invite friends">
      <div className="stack" style={{ gap: 16 }}>
        <p className="muted" style={{ margin: 0, textAlign: 'center' }}>
          Friends scan this, open the link, or type the code.
        </p>
        <div className="code-tiles" aria-label={`Game code ${game.code.split('').join(' ')}`}>
          {game.code.split('').map((ch, i) => (
            <span key={i} style={{ background: TILE_COLORS[i % TILE_COLORS.length], animationDelay: `${i * 60}ms` }}>
              {ch}
            </span>
          ))}
        </div>
        <div className="qr-box">
          <QRCode text={link} size={196} />
        </div>
        <button type="button" className="btn btn-xl btn-blue" onClick={() => void share()}>
          <ShareIcon width={26} height={26} /> Share link
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void copy(link)}>
          <CopyIcon width={24} height={24} /> Copy link
        </button>
      </div>
    </Sheet>
  );
}
