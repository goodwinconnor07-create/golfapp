import { describe, expect, it } from 'vitest';
import { homeInsights, lastGroup } from './insights';
import type { GameRecord } from './persist';

const player = (name: string, rank: number) => ({ name, color: 0, rank, toPar: 0, strokes: 40 });

function record(id: string, mine?: GameRecord['mine'], names = ['Kavi', 'Sam']): GameRecord {
  return { id, finishedAt: 0, course: 'Riverside', holes: 9, players: names.map((n, i) => player(n, i + 1)), mine };
}

const stats = (bold: number, boldMade: number, rank = 1): GameRecord['mine'] => ({
  name: 'Kavi',
  rank,
  picks: { safe: 1, bold, insane: 1 },
  made: { safe: 1, bold: boldMade, insane: 0 },
  cards: { B18: [bold, boldMade], S02: [1, 1], I20: [1, 0] },
});

describe('home insights', () => {
  it('is empty until this phone has hosted a round', () => {
    expect(homeInsights([record('a')])).toBeNull();
  });

  it('adds up the host rounds only', () => {
    const i = homeInsights([record('a', stats(4, 3)), record('b'), record('c', stats(3, 1, 2))])!;
    expect(i.rounds).toBe(2);
    expect(i.wins).toBe(1);
    expect(i.picks).toEqual({ safe: 2, bold: 7, insane: 2 });
    expect(i.mostly).toBe('bold');
    expect(i.cards.insane).toEqual([2, 0]);
    expect(i.best).toEqual({ cardId: 'B18', drawn: 7, made: 4 });
  });

  it('calls it a mix when no level leads', () => {
    const even: GameRecord['mine'] = { name: 'Kavi', rank: 1, picks: { safe: 3, bold: 3, insane: 3 }, made: { safe: 0, bold: 0, insane: 0 }, cards: {} };
    const i = homeInsights([record('a', even)])!;
    expect(i.mostly).toBeNull();
    expect(i.best).toBeNull();
  });
});

describe('last group', () => {
  it('is everyone else from the newest hosted round with company', () => {
    const solo = record('solo', stats(1, 1), ['Kavi']);
    const g = lastGroup([solo, record('joined'), record('hosted', stats(1, 1), ['Sam', 'Kavi', 'Jo'])])!;
    expect(g.players.map((p) => p.name)).toEqual(['Sam', 'Jo']);
  });
});
