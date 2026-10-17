// Draws the end-of-round results as a picture for the group chat.
// Portrait 1080×1350, which chat apps and stories show without cropping.

import { formatToPar, toParWords, type Game, type Recap } from '../game';
import { publicOrigin } from '../state/platform';
import { playerColor } from './components';
import { avatarInk } from './theme';
import { joinNames, plural } from './format';

const W = 1080;
const H = 1350;
const FONT = '-apple-system, "SF Pro Display", system-ui, "Segoe UI", Roboto, sans-serif';
const INK = '#0f172a';
const MUTED = '#64748b';
const MAX_ROWS = 6;

function font(size: number, weight = 900, italic = false): string {
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT}`;
}

/** Shrinks text until it fits the width, so long names never run off the card. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, size: number, weight = 900) {
  let s = size;
  ctx.font = font(s, weight);
  while (s > 20 && ctx.measureText(text).width > maxWidth) {
    s -= 2;
    ctx.font = font(s, weight);
  }
  let t = text;
  while (t.length > 1 && ctx.measureText(t).width > maxWidth) t = t.slice(0, -2) + '…';
  ctx.fillText(t, x, y);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawResults(game: Game, rc: Recap): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // White card with soft colour in the corners, like the app.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  const glow = (x: number, y: number, r: number, colour: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colour);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(0, 0, 620, 'rgba(45, 212, 191, 0.28)');
  glow(W, H * 0.55, 640, 'rgba(251, 146, 60, 0.26)');
  glow(W * 0.3, H, 600, 'rgba(167, 139, 250, 0.28)');

  // Header: logo word and the round.
  const brand = ctx.createLinearGradient(80, 0, 560, 0);
  brand.addColorStop(0, '#0f766e');
  brand.addColorStop(0.5, '#c2410c');
  brand.addColorStop(1, '#7c3aed');
  ctx.fillStyle = brand;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = font(96, 900, true);
  ctx.fillText('CARDSHOT', 80, 170);
  ctx.fillStyle = MUTED;
  const where = [
    game.course,
    plural(rc.holesPlayed, 'hole'),
    new Date(game.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
  ]
    .filter(Boolean)
    .join(' · ');
  fitText(ctx, where, 80, 232, W - 160, 38, 800);

  // Winner.
  let y = 330;
  if (rc.winners.length) {
    const who = joinNames(rc.winners.map((w) => w.player.name));
    ctx.fillStyle = INK;
    fitText(ctx, `🏆 ${who} ${rc.winners.length > 1 ? 'tie!' : 'wins!'}`, 80, y + 50, W - 160, 84);
    ctx.fillStyle = MUTED;
    ctx.font = font(40, 800);
    ctx.fillText(toParWords(rc.winners[0].totals.toPar), 80, y + 112);
    y += 170;
  }

  // Standings.
  const rows = rc.byGame.slice(0, MAX_ROWS);
  const rowH = 104;
  for (const [i, r] of rows.entries()) {
    const top = y + i * (rowH + 14);
    ctx.fillStyle = i === 0 ? 'rgba(251, 191, 36, 0.18)' : 'rgba(15, 23, 42, 0.05)';
    roundRect(ctx, 60, top, W - 120, rowH, 30);
    ctx.fill();

    ctx.fillStyle = MUTED;
    ctx.font = font(40);
    ctx.textAlign = 'center';
    ctx.fillText(`${r.tied ? '=' : ''}${r.rank}`, 120, top + 66);

    // Avatar circle with their emoji or initial.
    ctx.fillStyle = playerColor(r.player.color);
    ctx.beginPath();
    ctx.arc(205, top + rowH / 2, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = avatarInk(playerColor(r.player.color));
    ctx.font = r.player.emoji ? '38px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' : font(34);
    ctx.fillText(r.player.emoji ?? [...r.player.name.trim()][0]?.toUpperCase() ?? '?', 205, top + rowH / 2 + 13);

    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    fitText(ctx, r.player.name, 262, top + 52, 470, 42);
    ctx.fillStyle = MUTED;
    ctx.font = font(26, 800);
    ctx.fillText(`${r.totals.made} of ${r.totals.holes} cards made · ${r.totals.real} strokes`, 262, top + 86);

    ctx.textAlign = 'right';
    ctx.fillStyle = INK;
    ctx.font = font(56);
    ctx.fillText(formatToPar(r.totals.toPar), W - 100, top + 72);
    ctx.textAlign = 'left';
  }
  y += rows.length * (rowH + 14);
  if (rc.byGame.length > MAX_ROWS) {
    ctx.fillStyle = MUTED;
    ctx.font = font(30, 800);
    ctx.fillText(`+ ${plural(rc.byGame.length - MAX_ROWS, 'more player')}`, 80, y + 30);
    y += 50;
  }

  // A couple of awards, if there's room.
  const awards = rc.awards.filter((a) => a.id !== 'real');
  const room = Math.max(0, Math.floor((H - 130 - (y + 30)) / 58));
  for (const a of awards.slice(0, Math.min(3, room))) {
    y += 58;
    const who = joinNames(a.playerIds.map((id) => game.players.find((p) => p.id === id)?.name ?? '?'));
    ctx.fillStyle = INK;
    fitText(ctx, `${a.emoji} ${a.title}: ${who}`, 80, y, W - 160, 34, 800);
  }

  // Footer.
  ctx.fillStyle = brand;
  roundRect(ctx, 0, H - 14, W, 14, 0);
  ctx.fill();
  ctx.fillStyle = MUTED;
  ctx.font = font(30, 800);
  ctx.textAlign = 'center';
  ctx.fillText(`Play at ${new URL(publicOrigin()).host}`, W / 2, H - 52);
  return canvas;
}

export function resultsImage(game: Game, rc: Recap): Promise<Blob | null> {
  const canvas = drawResults(game, rc);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
