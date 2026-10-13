import { formatSigned } from '../game';

/** The sum, spelled out: "5 − 4 = 1", "5 + 2 = 7", or "5 (no change)". */
export function calcText(strokes: number, adjustment: number, gameScore: number): string {
  if (adjustment === 0) return `${strokes} (no change)`;
  const sign = adjustment < 0 ? '−' : '+';
  return `${strokes} ${sign} ${Math.abs(adjustment)} = ${formatSigned(gameScore)}`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}
