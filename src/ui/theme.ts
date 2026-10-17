// Colours used from code. Everything the stylesheets use lives as tokens in global.css;
// these are the few that need a real value (canvas drawing, confetti) or a per-item pick.

/**
 * Avatar backgrounds: the primary and secondary colours (blue, red, yellow, green, orange, purple),
 * then pink and black so a full table of 8 each gets their own. Order matters: games save the index.
 */
export const PLAYER_COLORS = ['#2563eb', '#dc2626', '#eab308', '#16a34a', '#f97316', '#9333ea', '#ec4899', '#18181b'];

/** Yellow is too light for white lettering. */
const DARK_INK_ON = new Set(['#eab308']);
export const AVATAR_INK_DARK = '#18181b';
export const avatarInk = (background: string): string => (DARK_INK_ON.has(background) ? AVATAR_INK_DARK : '#fff');

/** Confetti, per moment. */
export const CONFETTI_COLORS = {
  party: ['#f97316', '#ec4899', '#8b5cf6', '#14b8a6', '#facc15', '#3b82f6'],
  safe: ['#14b8a6', '#0d9488', '#5eead4', '#facc15'],
  bold: ['#fb923c', '#ea580c', '#fdba74', '#facc15'],
  insane: ['#a855f7', '#7c3aed', '#d946ef', '#f0abfc', '#facc15'],
};

/** The join-code letter tiles. */
export const TILE_COLORS = ['var(--brand-1)', 'var(--brand-2)', 'var(--brand-3)', 'var(--blue)', 'var(--safe)'];

/** Soft colour blobs behind the home screen. */
export const BLOB_COLORS = ['#60a5fa', '#1e3a6e', '#e11d48'];
