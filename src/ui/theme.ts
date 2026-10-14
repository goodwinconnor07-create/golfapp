// Colours used from code. Everything the stylesheets use lives as tokens in global.css;
// these are the few that need a real value (canvas drawing, confetti) or a per-item pick.

/** Avatar backgrounds. Kept away from the tier colours (teal, orange, violet) and from pass/fail green and red. */
export const PLAYER_COLORS = ['#2563eb', '#9d174d', '#475569', '#92400e', '#1e3a8a', '#0284c7', '#18181b', '#a16207'];

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
export const BLOB_COLORS = ['#14b8a6', '#f97316', '#8b5cf6'];
