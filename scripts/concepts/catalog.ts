// Every design tested. Values marked TUNE are searched by tune-all.ts; the rest are fixed.
import { BASE, BASE_DECK, type Concept } from './engine';

const without = (d: Record<string, string>, ...ids: string[]) => Object.fromEntries(Object.entries(d).filter(([id]) => !ids.includes(id)));

/**
 * Deck v3 (audit fixes): Sink a Tiddler (3 ft, feels trivial, eye-judged), Big Improvement (reverse skill
 * slope) and One-Putt Green (same test as One and Done) out. Tidy Hole (81%, the best card in the game at
 * Bold) moves to Safe. In: Personal Par (Bold) and Beat Your Average (Insane), judged from strokes against
 * your own round so far.
 */
export const DECK_V3: Record<string, string> = {
  ...without(BASE_DECK, 'I17', 'I21', 'I22', 'B18'),
  B18: 'safe', // stands for a new Safe copy of Tidy Hole
  P01: 'bold',
  P02: 'insane',
};
/** Deck v4: v3 without Short Knee-Knocker (lag-short exploit, judged by eye). No Insane card hangs on a putt length. */
export const DECK_V4: Record<string, string> = without(DECK_V3, 'I16');
/** Deck v3 plus head-to-head cards: Match a Rival (Bold), Beat a Rival (Insane). */
export const DECK_DUEL: Record<string, string> = { ...DECK_V3, D03: 'bold', D01: 'insane' };

export const CONCEPTS: Record<string, Concept & { tune?: 'grid3' | 'grid2' | 'grid4' | 'gridPts' }> = {
  today: BASE,
  noDouble: { ...BASE, name: 'Today without the 2× finish', double: false, tune: 'grid3' },
  hand: { ...BASE, name: 'See your hand: one card from each level, then pick', decision: 'hand', tune: 'grid3' },
  deckV3: { ...BASE, name: 'Deck v3 (audit fixes + personal par)', deck: DECK_V3, tune: 'grid3' },
  deckDuel: { ...BASE, name: 'Deck v3 + head-to-head cards', deck: DECK_DUEL, tune: 'grid3' },
  skins: { ...BASE, name: 'Skins: win the hole outright, ties carry over', format: 'skins', tune: 'grid3' },
  gp: { ...BASE, name: 'Grand Prix: points by place each hole (4/2/1/0)', format: 'gp', gp: [4, 2, 1, 0], tune: 'grid3' },
  gpFlat: { ...BASE, name: 'Grand Prix, flatter points (3/2/1/0)', format: 'gp', gp: [3, 2, 1, 0], tune: 'grid3' },
  gpPts: { ...BASE, name: 'Grand Prix: place on real strokes (4/2/1/0) + card points', format: 'gp', gp: [4, 2, 1, 0], cardPoints: true, values: { safe: [-1, 0], bold: [-2, 1], insane: [-6, 2] }, tune: 'gridPts' },
  skinsPts: { ...BASE, name: 'Skins on real strokes + card points', format: 'skins', cardPoints: true, values: { safe: [-1, 0], bold: [-2, 1], insane: [-6, 2] }, tune: 'gridPts' },
  match: { ...BASE, name: 'Match play: a point for each friend you beat on the hole', format: 'match', tune: 'grid3' },
  wolf: { ...BASE, name: 'Wolf: rotating Wolf sees the cards, picks a partner or goes alone', format: 'wolf', tune: 'grid3' },
  stableford: { ...BASE, name: 'Stableford: points per hole, blow-ups floor at 0', format: 'stableford', tune: 'grid3' },
  twoLevels: {
    ...BASE,
    name: 'Two levels only: Safe or Send It',
    tiers: ['safe', 'insane'],
    deck: Object.fromEntries(Object.entries(BASE_DECK).filter(([, t]) => t !== 'bold')),
    tune: 'grid2',
  },
  fourLevels: {
    ...BASE,
    name: 'Four levels: + Legend jackpot (~12%)',
    tiers: ['safe', 'bold', 'insane', 'legend'],
    values: { ...BASE.values, legend: [-20, 4] },
    deck: { ...without(BASE_DECK, 'I21', 'I22'), D02: 'legend', I03: 'legend', I22: 'legend', I21: 'legend' },
    tune: 'grid4',
  },
  // Phase 2: combinations of what worked.
  showdown: { ...BASE, name: 'See your hand + deck v3 (stroke play)', decision: 'hand', deck: DECK_V3, tune: 'grid3' },
  showdownDuel: { ...BASE, name: 'See your hand + deck v3 + head-to-head cards', decision: 'hand', deck: DECK_DUEL, tune: 'grid3' },
  gpHand: { ...BASE, name: 'Grand Prix + card points + see your hand + deck v3', format: 'gp', gp: [4, 2, 1, 0], cardPoints: true, decision: 'hand', deck: DECK_V3, values: { safe: [-1, 0], bold: [-2, 1], insane: [-6, 2] }, tune: 'gridPts' },
  skinsHand: { ...BASE, name: 'Skins + card points + see your hand + deck v3', format: 'skins', cardPoints: true, decision: 'hand', deck: DECK_V3, values: { safe: [-1, 0], bold: [-2, 1], insane: [-6, 2] }, tune: 'gridPts' },
  showdownKing: { ...BASE, name: 'See your hand + deck v3 + King of the Hill', decision: 'hand', deck: DECK_V3, addons: { king: true }, values: { safe: [-1, 1], bold: [-2, 2], insane: [-9, 4] } },
  gpHandKing: { ...BASE, name: 'Grand Prix + card points + hand + deck v3 + King', format: 'gp', gp: [4, 2, 1, 0], cardPoints: true, decision: 'hand', deck: DECK_V3, addons: { king: true }, values: { safe: [-1, 0], bold: [-2, 1], insane: [-7, 2] } },
  skinsHandKing: { ...BASE, name: 'Skins + card points + hand + deck v3 + King', format: 'skins', cardPoints: true, decision: 'hand', deck: DECK_V3, addons: { king: true }, values: { safe: [-1, 1], bold: [-2, 2], insane: [-7, 3] } },
  gpNet: { ...BASE, name: 'Net Grand Prix: place on strokes vs your own average + card points + hand + deck v3', format: 'gp', gp: [4, 2, 1, 0], cardPoints: true, net: true, decision: 'hand', deck: DECK_V3, values: { safe: [-1, 0], bold: [-2, 1], insane: [-7, 2] } },
  gpNetKing: { ...BASE, name: 'Net Grand Prix + card points + hand + deck v3 + King', format: 'gp', gp: [4, 2, 1, 0], cardPoints: true, net: true, decision: 'hand', deck: DECK_V3, addons: { king: true }, values: { safe: [-1, 0], bold: [-2, 1], insane: [-7, 2] } },
  showdownLite: { ...BASE, name: 'See your hand + deck v3, smaller values (Insane −6/+3)', decision: 'hand', deck: DECK_V3, values: { safe: [-1, 1], bold: [-2, 2], insane: [-6, 3] } },
  showdownHoleWin: { ...BASE, name: 'See your hand + deck v3 + hole winner −1', decision: 'hand', deck: DECK_V3, addons: { holeWin: true }, values: { safe: [-1, 1], bold: [-2, 2], insane: [-9, 4] } },
  holeWin: { ...BASE, name: 'Today + hole winner −1', addons: { holeWin: true } },
  showdownV4: { ...BASE, name: 'See your hand + deck v4', decision: 'hand', deck: DECK_V4, values: { safe: [-1, 1], bold: [-2, 2], insane: [-9, 4] } },
  showdownV4King: { ...BASE, name: 'See your hand + deck v4 + King of the Hill', decision: 'hand', deck: DECK_V4, addons: { king: true }, values: { safe: [-1, 1], bold: [-2, 2], insane: [-9, 4] } },
  hex: { ...BASE, name: 'Today + Hex: complete Insane, then ban someone from Safe on a hole', addons: { hex: true } },
  callout: { ...BASE, name: 'Today + Call-out duels: beat who you called, take 1 off them', addons: { callout: true } },
  king: { ...BASE, name: 'Today + King of the Hill: beat the leader on a hole, −1', addons: { king: true } },
  predict: { ...BASE, name: "Today + Predictions: call each friend's card, ½ stroke a right call", addons: { predict: true } },
  press: { ...BASE, name: 'Today + Press: once a nine, double your own card values for the rest of it', addons: { press: true } },
};
