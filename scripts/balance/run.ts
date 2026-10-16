// npm run balance: checks the game in src/game against the targets in docs/GAME_BALANCE.md.
// Try a value change without editing code: BALANCE_VALUES="-1/1,-2/2,-9/3" npm run balance
// Quicker, noisier run: BALANCE_GAMES=800 npm run balance
import { mulberry32, type Rng } from './golf';
import { buildTable, currentConfig, MIX_H, PLANS, playRound, summarise, tierEV, tierOdds, TIERS, type Config, type Round } from './sim';

const GAMES = Number(process.env.BALANCE_GAMES ?? 2500);
const rng: Rng = mulberry32(Number(process.env.BALANCE_SEED ?? 2026));
const cfg: Config = currentConfig();
if (process.env.BALANCE_VALUES) {
  process.env.BALANCE_VALUES.split(',').forEach((v, i) => {
    const [m, x] = v.split('/').map(Number);
    cfg.made[TIERS[i]] = m;
    cfg.fail[TIERS[i]] = x;
  });
}

console.log('Building the card odds table…');
const t = buildTable(rng, Number(process.env.BALANCE_SAMPLES ?? 4000));
const u = (a: number, b: number) => a + rng() * (b - a);
const near = (lo: number, hi: number, k: number) => () => {
  const c = u(lo, hi);
  return Array.from({ length: k }, () => Math.round(c + u(-3, 3)));
};
const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
const vals = TIERS.map((tr) => `${tr} ${cfg.made[tr]}/+${cfg.fail[tr]}`).join('  ');
console.log(`\nValues: ${vals}   Deck: ${TIERS.map((tr) => `${Object.values(cfg.deck).filter((x) => x === tr).length} ${tr}`).join(', ')}`);
console.log(
  'Completion odds (12 / 22 / 32 hcp):',
  TIERS.map((tr) => `${tr} ${[12, 22, 32].map((h) => pct(tierOdds(t, cfg, tr, h))).join('/')}`).join('   '),
);
const ev = (tr: (typeof TIERS)[number]) => MIX_H.reduce((a, h) => a + tierEV(t, cfg, tr, h).ev, 0) / MIX_H.length;
console.log('Average strokes per pick, 10–36 hcp:', TIERS.map((tr) => `${tr} ${ev(tr).toFixed(2)}`).join('  '));

// 1. Strategy test
const checks: [string, boolean][] = [];
console.log('\n1. STRATEGY TEST: 4 similar golfers, each on a different plan, 18 holes (1.00 = fair share of wins)');
for (const [label, lo, hi] of [
  ['all 10–32', 10, 32],
  ['dads 10–20', 10, 20],
  ['teens 20–36', 20, 36],
] as const) {
  const rs: Round[] = [];
  for (let g = 0; g < GAMES; g++)
    rs.push(
      playRound(
        t,
        cfg,
        near(lo, hi, 4)(),
        PLANS.slice()
          .sort(() => rng() - 0.5)
          .slice(0, 4),
        18,
        rng,
      ),
    );
  const s = summarise(rs).style;
  console.log(`  ${label.padEnd(12)}`, PLANS.map((p) => `${p} ${s[p].toFixed(2)}`).join('  '));
  if (label === 'all 10–32') {
    const fixed = [s.aSafe, s.aBold, s.aInsane];
    checks.push([
      'No "always X" plan wins clearly more: always-Safe/Bold/Insane within 0.35 of each other',
      Math.max(...fixed) - Math.min(...fixed) <= 0.35,
    ]);
    checks.push(['No "always X" plan reaches 1.10', Math.max(...fixed) < 1.1]);
    checks.push(['Smart beats every fixed plan', s.smart > Math.max(...fixed, s.protect, s.random)]);
  }
}

// 2. How it plays
console.log('\n2. HOW IT PLAYS (mixed personalities)');
const GROUPS: [string, () => number[], number][] = [
  ['Similar 4p, 18 holes', near(10, 32, 4), 18],
  ['Similar 3p, 18 holes', near(10, 32, 3), 18],
  ['Dads 4p (10–20)', () => [0, 0, 0, 0].map(() => Math.round(u(10, 20))), 18],
  ['Teens 4p (20–36)', () => [0, 0, 0, 0].map(() => Math.round(u(20, 36))), 18],
  ['Mixed 4p (12/18/24/30)', () => [12, 18, 24, 30], 18],
  ['1v1 similar, 18 holes', near(10, 32, 2), 18],
  ['Similar 4p, 9 holes', near(10, 32, 4), 9],
];
console.log('  group'.padEnd(26), 'ldr@3  last3  led½  cmbk  chg  margin  ≤2   best  worst | picks S/B/I     | made S/B/I');
for (const [label, hs, n] of GROUPS) {
  const rs: Round[] = [];
  for (let g = 0; g < GAMES; g++) {
    const h = hs();
    rs.push(
      playRound(
        t,
        cfg,
        h,
        h.map(() => null),
        n,
        rng,
      ),
    );
  }
  const s = summarise(rs);
  console.log(
    `  ${label.padEnd(24)}`,
    [s.leaderWith3ToGo, s.decidedLast3, s.ledFromHalfway, s.comeback].map((x) => pct(x).padStart(5)).join(' '),
    s.leadChanges.toFixed(1).padStart(4),
    s.margin.toFixed(1).padStart(7),
    pct(s.within2).padStart(4),
    s.bestGolfer.toFixed(2).padStart(5),
    s.worstGolfer.toFixed(2).padStart(5),
    '|',
    TIERS.map((tr) => pct(s.picks[tr]))
      .join('/')
      .padEnd(15),
    '|',
    TIERS.map((tr) => pct(s.made[tr])).join('/'),
  );
  if (label === 'Similar 4p, 18 holes') {
    checks.push(['Picks within 28–40% for each level', TIERS.every((tr) => s.picks[tr] >= 0.28 && s.picks[tr] <= 0.4)]);
    checks.push(['Leader with 3 to go wins no more than 70%', s.leaderWith3ToGo <= 0.7]);
    checks.push(['At least 35% of games decided in the last 3 holes', s.decidedLast3 >= 0.35]);
  }
  if (label === 'Mixed 4p (12/18/24/30)')
    checks.push(['Best golfer in a mixed group wins no more than 2.3× fair share (today was 2.27)', s.bestGolfer <= 2.3]);
}

console.log('\nTARGETS (docs/GAME_BALANCE.md)');
for (const [what, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
console.log(
  `\n${checks.every(([, ok]) => ok) ? 'All targets met.' : 'Some targets missed: see docs/GAME_BALANCE.md before shipping this change.'}`,
);
