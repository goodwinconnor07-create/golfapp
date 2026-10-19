// npm run balance: checks the game new rounds use (ruleset 2: a hand of three, card packs, the Crown)
// against the targets in docs/GAME_BALANCE.md, with the deck and values currently in src/game.
// BALANCE_PACKS="core,nameIt" to check other packs; BALANCE_GAMES=800 for a quicker, noisier run.
// Older games keep deck v2 and the old values: npm run balance:legacy.
import { CARDS, DEFAULT_PACKS, packOf, TIERS_V2, type PackId } from '../../src/game';
import { BASE, buildBank, PARS_OF, type Concept } from '../concepts/engine';
import { evaluate, print } from '../concepts/eval';
import { SIM_ID } from '../concepts/simIds';

const packs = (process.env.BALANCE_PACKS?.split(',') as PackId[] | undefined) ?? [...DEFAULT_PACKS];
const deck: Record<string, string> = {};
const missing: string[] = [];
for (const c of CARDS) {
  if (!c.enabled || c.legacyOnly || c.situational || !packs.includes(packOf(c))) continue;
  const id = SIM_ID[c.id] ?? c.id;
  if (!PARS_OF[id]) missing.push(c.id);
  else deck[id] = c.tier;
}
if (missing.length) throw new Error(`No simulator check for card(s) ${missing.join(', ')}. Map them in scripts/concepts/simIds.ts.`);

const concept: Concept = {
  ...BASE,
  name: `Ruleset 2: ${packs.join(', ')}`,
  decision: 'hand',
  deck,
  addons: { king: true, noRepeat: true },
  values: {
    safe: [TIERS_V2.safe.made, TIERS_V2.safe.missed],
    bold: [TIERS_V2.bold.made, TIERS_V2.bold.missed],
    insane: [TIERS_V2.insane.made, TIERS_V2.insane.missed],
  },
};

console.log('Building the hole bank…');
buildBank(5000);
const m = evaluate(concept, { games: Number(process.env.BALANCE_GAMES ?? 1500), probGames: 200, probR: 100, thinkGames: 0 });
print(m);

const picks = Object.values(m.picks);
const checks: [string, boolean][] = [
  ['Thinking pays: always picking the same level wins under 0.75× its share against normal players', Math.max(...m.fixed) < 0.75],
  [
    'No level is the one to always pick: "always Safe/Bold/Insane" within 0.35 of each other',
    Math.max(...m.fixed) - Math.min(...m.fixed) <= 0.35,
  ],
  ['Each level picked 15–55% of the time', picks.every((p) => p >= 0.15 && p <= 0.55)],
  ['Leader with 3 to go wins no more than 60%', m.leaderAt3 <= 0.6],
  ['At least 45% of games decided in the last 3 holes', m.decidedLast3 >= 0.45],
  ['The last hole is still live (2+ players with a 10% chance) in at least 65% of rounds', m.lastHoleLive >= 0.65],
  ['Best golfer in a 12/18/24/30 group wins no more than 2.6× fair share', m.bestMixed <= 2.6],
  ['No more than 30 strokes a round ride on cards judged by eye', m.eyeStrokes <= 30],
];
console.log('\nTARGETS (docs/GAME_BALANCE.md, ruleset 2)');
for (const [what, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
console.log(
  `\n${checks.every(([, ok]) => ok) ? 'All targets met.' : 'Some targets missed: see docs/GAME_BALANCE.md before shipping this change.'}`,
);
