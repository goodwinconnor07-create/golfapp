import { formatSigned, toParWords } from '../game';

/** The sum, spelled out: "9 − 2 = 7 (2 over)". Pass par to add the over/under part. */
export function calcText(strokes: number, adjustment: number, gameScore: number, par?: number): string {
  const vsPar = par == null ? '' : toParWords(gameScore - par);
  if (adjustment === 0) return `${strokes} (no change${vsPar ? `, ${vsPar}` : ''})`;
  const sign = adjustment < 0 ? '−' : '+';
  return `${strokes} ${sign} ${Math.abs(adjustment)} = ${formatSigned(gameScore)}${vsPar ? ` (${vsPar})` : ''}`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}
