export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** A running clock: "4:07", or "1:02:07" past an hour. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}

/** A finished length of time: "2h 14m", "48m", or "under a minute". */
export function duration(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60_000);
  if (m < 1) return 'under a minute';
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

/** "13 strokes · 2 of 3 cards completed": the same detail line on standings, final results and the picture. */
export function roundLine(totals: { real: number; made: number; holes: number }): string {
  return `${plural(totals.real, 'stroke')} · ${totals.made} of ${plural(totals.holes, 'card')} completed`;
}

/** A win chance as people say it: "41% to win", with "<1%" and ">99%" at the ends. */
export function winText(p: number): string {
  const pct = p < 0.005 ? '<1%' : p > 0.995 ? '>99%' : `${Math.round(p * 100)}%`;
  return `${pct} to win`;
}
