export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** "13 strokes · 2 of 3 cards completed": the same detail line on standings, final results and the picture. */
export function roundLine(totals: { real: number; made: number; holes: number }): string {
  return `${plural(totals.real, 'stroke')} · ${totals.made} of ${plural(totals.holes, 'card')} completed`;
}
