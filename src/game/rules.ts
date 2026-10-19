import { CARDS, DEFAULT_PACKS, getCard, MULTI_HOLES, packOf, type CardDef } from './cards';
import { adjustmentFor } from './tiers';
import type { Entry, FixRequest, Game, Outcome, Par, Settings, Team, Tier } from './types';

/** A ruleset 2 game: players pick from a hand of three (docs/DECISIONS.md, "The Showdown update"). */
export const isV2 = (game: Pick<Game, 'rules'>): boolean => game.rules === 2;

/** The last few holes of a round count double, so whoever's behind still has a shot. */
export const DOUBLE_STAKES_HOLES = 3;
/** Rounds shorter than this play at normal stakes throughout. */
export const DOUBLE_STAKES_MIN_ROUND = 6;

export function isDoubleHole(game: Pick<Game, 'holes'>, hole: number): boolean {
  const n = game.holes.length;
  return n >= DOUBLE_STAKES_MIN_ROUND && hole >= n - DOUBLE_STAKES_HOLES;
}

/**
 * Strokes a card adds or takes off on this hole: the tier's modifier, doubled on the
 * last holes, and nothing for a failed free shot. The tier values themselves never change.
 */
export function stakeFor(
  game: Pick<Game, 'holes' | 'teams' | 'rules'>,
  hole: number,
  tier: Tier,
  outcome: Outcome,
  freePass = false,
): number {
  if (outcome === 'missed' && freePass) return 0;
  return adjustmentFor(tier, outcome, Boolean(game.teams), game.rules) * (isDoubleHole(game, hole) ? 2 : 1);
}

/** What completing and failing a card is worth on this hole, for showing on cards and buttons. */
export function cardStakes(
  game: Pick<Game, 'holes' | 'teams' | 'rules'>,
  hole: number,
  tier: Tier,
  freePass = false,
): { made: number; missed: number } {
  return { made: stakeFor(game, hole, tier, 'made'), missed: stakeFor(game, hole, tier, 'missed', freePass) };
}

// ── Teams ────────────────────────────────────────────────────────────────────

export function teamOf(game: Pick<Game, 'teams'>, playerId: string): Team | undefined {
  return game.teams?.find((t) => t.players.includes(playerId));
}

/** The other player on this player's team, if teams are on. */
export function mateOf(game: Pick<Game, 'teams'>, playerId: string): string | undefined {
  const t = teamOf(game, playerId);
  return t ? t.players.find((id) => id !== playerId) : undefined;
}

/** The team completes a card when either partner does. Missed only once both are in and neither did. */
function teamResolve(own: Outcome | null, mate: Outcome | null): Outcome | null {
  if (own == null) return null;
  if (own === 'made' || mate === 'made') return 'made';
  if (mate == null) return null;
  return own === 'na' && mate === 'na' ? 'na' : 'missed';
}

/** Honour-system cards (judged by eye) go to a group vote when someone says they made it. */
export function needsVote(card: CardDef | undefined): boolean {
  return Boolean(card?.distance);
}

export function voteTally(entry: Entry | undefined): { fair: number; unfair: number } {
  const votes = Object.values(entry?.votes ?? {});
  return { fair: votes.filter(Boolean).length, unfair: votes.filter((v) => !v).length };
}

export function entryKey(playerId: string, hole: number): string {
  return `${playerId}:${hole}`;
}

export function getEntry(game: Game, playerId: string, hole: number): Entry | undefined {
  return game.entries[entryKey(playerId, hole)];
}

/** Can this card be dealt on a hole with this par, under these game settings? */
export function isEligible(card: CardDef, par: Par, settings: Settings): boolean {
  if (!card.enabled || card.v2) return false;
  if (!card.pars.includes(par)) return false;
  if (card.distance && !settings.distanceCards) return false;
  if (card.situational && !settings.situationCards) return false;
  return true;
}

export function eligibleCards(tier: Tier, par: Par, settings: Settings): CardDef[] {
  return CARDS.filter((c) => c.tier === tier && isEligible(c, par, settings));
}

/** The player's strokes and the par on the hole before this one, or null if there isn't one yet. */
export function lastHole(game: Game, playerId: string, hole: number): { strokes: number; par: number } | null {
  if (hole <= 0) return null;
  const prev = getEntry(game, playerId, hole - 1);
  const par = game.holes[hole - 1]?.par;
  return prev?.strokes != null && par != null ? { strokes: prev.strokes, par } : null;
}

/** The player's score against par on the hole before this one, or null if there isn't one yet. */
export function lastHoleToPar(game: Game, playerId: string, hole: number): number | null {
  const last = lastHole(game, playerId, hole);
  return last ? last.strokes - last.par : null;
}

// ── Ruleset 2: hands, judging against your own round, friends and streaks ────────────────

/** Packs in play (ruleset 2). */
export function packsInPlay(game: Pick<Game, 'settings'>): readonly string[] {
  return game.settings.packs ?? DEFAULT_PACKS;
}

/**
 * Can this card go in a ruleset 2 hand on this hole? (Who holds it is checked in hand.ts: a streak
 * card isn't dealt right after another one.)
 */
export function fitsHand(game: Game, card: CardDef, hole: number): boolean {
  const par = game.holes[hole]?.par;
  if (!card.enabled || card.legacyOnly || card.situational || par == null) return false;
  if (!packsInPlay(game).includes(packOf(card))) return false;
  if (!card.pars.includes(par)) return false;
  if (card.distance && !game.settings.distanceCards) return false;
  if (card.noTeams && game.teams) return false;
  if (card.group && game.players.length < 2) return false;
  if (card.multi && hole > game.holes.length - MULTI_HOLES) return false;
  return true;
}

/** The player's strokes against par on holes before this one that have a score. */
function earlierToPar(game: Game, playerId: string, hole: number): number[] {
  const out: number[] = [];
  for (let h = 0; h < hole; h++) {
    const e = getEntry(game, playerId, h);
    const par = game.holes[h]?.par;
    if (e?.strokes != null && par != null) out.push(e.strokes - par);
  }
  return out;
}

/** Score against par per hole so far, starting from bogey (as if two bogey holes came first). */
export function personalAverage(game: Game, playerId: string, hole: number): number {
  const seen = earlierToPar(game, playerId, hole);
  return (seen.reduce((a, b) => a + b, 0) + 2) / (seen.length + 2);
}

/** The number a Name It card asks for at this level: score to par, strokes to the green, or putts. */
export function nameItTarget(game: Game, playerId: string, hole: number, card: CardDef, tier: Tier): number | null {
  const opt = card.nameIt?.[tier];
  const par = game.holes[hole]?.par;
  if (!opt || par == null) return null;
  if (opt.kind === 'average') return Math.floor(personalAverage(game, playerId, hole) + 0.5) + opt.by;
  if (opt.kind === 'green') return Math.max(1, par + opt.by);
  return opt.by;
}

/** Ruleset 2 cards judged from this player's own strokes (and their round so far). null = someone has to say. */
export function judgeAuto(game: Game, playerId: string, hole: number, strokes: number): 'made' | 'missed' | null {
  const entry = getEntry(game, playerId, hole);
  const card = getCard(entry?.cardId);
  const par = game.holes[hole]?.par;
  if (!card || par == null) return null;
  const toPar = strokes - par;
  const verdict = (ok: boolean) => (ok ? 'made' : 'missed');
  if (card.self) {
    const seen = earlierToPar(game, playerId, hole);
    const avg = personalAverage(game, playerId, hole);
    if (card.self === 'personalPar') return verdict(toPar <= avg + 1e-9);
    if (card.self === 'beatAverage') return verdict(toPar <= avg - 1 + 1e-9);
    if (card.self === 'personalBest') return verdict(toPar <= (seen.length ? Math.min(...seen) : 1));
    const last3 = seen.slice(-3);
    return verdict(toPar < (last3.length >= 3 ? last3.reduce((a, b) => a + b, 0) / 3 : avg) - 1e-9);
  }
  if (card.nameIt && entry?.tier) {
    const opt = card.nameIt[entry.tier];
    const target = entry.target;
    if (!opt || target == null) return null;
    if (opt.kind === 'average') return verdict(toPar <= target);
    // Holing out within the number means the ball reached the green within it too.
    if (opt.kind === 'green') return strokes <= target ? 'made' : null;
    return null;
  }
  if (card.multi || card.group) return null;
  return judgeFromStrokes(card, par, strokes, lastHoleToPar(game, playerId, hole));
}

/** Results a player can tap for this card. Empty when the app works it out. */
export function tapChoices(game: Pick<Game, 'rules'>, card: CardDef, tier?: Tier): Outcome[] {
  if (!isV2(game)) return outcomeChoices(card);
  if (card.self || card.multi || card.group) return [];
  if (card.nameIt) return tier && card.nameIt[tier]?.kind === 'average' ? [] : ['made', 'missed'];
  return outcomeChoices(card);
}

/** Per-game cache for results that need the rest of the game. Games are never changed after an action. */
const CACHE = new WeakMap<Game, { seq: number; map: Map<string, unknown> }>();
function cached<T>(game: Game, key: string, f: () => T): T {
  let c = CACHE.get(game);
  if (!c || c.seq !== game.seq) CACHE.set(game, (c = { seq: game.seq, map: new Map() }));
  if (c.map.has(key)) return c.map.get(key) as T;
  const v = f();
  c.map.set(key, v);
  return v;
}

/** A streak card's result: settled on a hole, or still running. */
export interface StreakResult {
  outcome: 'made' | 'missed' | 'running';
  /** The hole that settled it. */
  at: number;
}

/** How a streak card picked on `start` is going. */
export function streakResult(game: Game, playerId: string, start: number): StreakResult | null {
  const entry = getEntry(game, playerId, start);
  const card = getCard(entry?.cardId);
  if (!card?.multi || entry?.strokes == null) return null;
  const last = Math.min(start + MULTI_HOLES - 1, game.holes.length - 1);
  for (let h = start; h <= last; h++) {
    const e = getEntry(game, playerId, h);
    const par = game.holes[h]?.par;
    if (card.multi === 'noDouble') {
      if (e?.strokes == null || par == null) return { outcome: 'running', at: h };
      if (e.strokes - par >= 2) return { outcome: 'missed', at: h };
    } else if (h > start) {
      // Hot Hand: the next cards have to be Bold or Insane, and completed.
      if (!e?.tier) return { outcome: 'running', at: h };
      if (e.tier === 'safe') return { outcome: 'missed', at: h };
      const o = cardOutcome(game, playerId, h);
      if (o == null || o === 'running') return { outcome: 'running', at: h };
      if (o !== 'made') return { outcome: 'missed', at: h };
    }
  }
  return { outcome: 'made', at: last };
}

/** Who's ahead of this player in game score after the holes before `hole` (ruleset 2, no teams). */
function aheadOf(game: Game, playerId: string, hole: number): string[] {
  const total = (id: string) => {
    let t = 0;
    for (let h = 0; h < hole; h++) {
      const r = holeResult(game, id, h);
      if (r) t += r.toPar;
    }
    return t;
  };
  const mine = total(playerId);
  return game.players.filter((p) => p.id !== playerId && total(p.id) < mine).map((p) => p.id);
}

/**
 * Ruleset 2: the result of the card itself on this hole (no Crown, no streak payouts).
 * running = a streak card still going. null = not settled yet (a score or a friend's result to come).
 */
export function cardOutcome(game: Game, playerId: string, hole: number, visiting: string[] = []): Outcome | 'running' | null {
  const entry = getEntry(game, playerId, hole);
  const card = getCard(entry?.cardId);
  const par = game.holes[hole]?.par;
  if (!entry || !card || entry.strokes == null || par == null) return null;
  if (card.multi) {
    const s = streakResult(game, playerId, hole);
    return !s || s.outcome === 'running' || s.at !== hole ? 'running' : s.outcome;
  }
  if (card.group) {
    const strokesOf = (id: string) => getEntry(game, id, hole)?.strokes;
    if (card.group === 'shadow') {
      const f = entry.friend ? strokesOf(entry.friend) : undefined;
      if (!entry.friend) return 'missed';
      return f == null ? null : entry.strokes <= f ? 'made' : 'missed';
    }
    if (card.group === 'underdog') {
      const ahead = aheadOf(game, playerId, hole);
      const rivals = ahead.length ? ahead : game.players.filter((p) => p.id !== playerId).map((p) => p.id);
      const theirs = rivals.map(strokesOf);
      if (theirs.some((x) => x == null)) return null;
      return theirs.some((x) => entry.strokes! < x!) ? 'made' : 'missed';
    }
    // Bodyguard: the friend's own card on this hole. A loop (two bodyguards on each other) fails.
    if (!entry.friend || visiting.includes(entry.friend)) return 'missed';
    const o = cardOutcome(game, entry.friend, hole, [...visiting, playerId]);
    if (o == null) return null;
    return o === 'made' ? 'made' : 'missed';
  }
  const auto = judgeAuto(game, playerId, hole, entry.strokes);
  if (auto) return auto;
  const claimed = entry.outcome ?? null;
  if (claimed === 'made' && needsVote(card)) {
    const { fair, unfair } = voteTally(entry);
    if (unfair > fair) return 'missed';
  }
  return claimed;
}

/**
 * The Crown (ruleset 2): whoever leads alone at the start of a hole wears it, and everyone who beats
 * their score on that hole takes a stroke off (two on the 2× holes). Worked out from the scores,
 * hole by hole, for whoever is ranked: players, or teams in 2v2.
 */
export function crownOn(game: Game): boolean {
  return isV2(game) && game.settings.crown !== false;
}

interface CrownState {
  upTo: number;
  totals: Map<string, number>;
  bonus: Map<string, number>;
  holder: Map<number, string | null>;
}

/** The ranked sides: each player, or each team as its two players. */
function sides(game: Game): { id: string; members: string[] }[] {
  return game.teams
    ? game.teams.map((t) => ({ id: t.id, members: [...t.players] }))
    : game.players.map((p) => ({ id: p.id, members: [p.id] }));
}

function crownState(game: Game, upTo: number): CrownState {
  const st = cached<CrownState>(game, 'crown', () => ({ upTo: -1, totals: new Map(), bonus: new Map(), holder: new Map() }));
  for (let h = st.upTo + 1; h <= upTo && h < game.holes.length; h++) {
    const ss = sides(game);
    const scores = ss.map((side) => {
      const rs = side.members.map((id) => baseHoleResult(game, id, h));
      return rs.every(Boolean) ? rs.reduce((a, r) => a + r!.toPar, 0) / rs.length : null;
    });
    // Only finished holes count; holes are finished in order, so stop at the first that isn't.
    if (scores.some((x) => x == null)) break;
    const tot = ss.map((side) => st.totals.get(side.id) ?? 0);
    const best = Math.min(...tot);
    const leaders = ss.filter((_, i) => tot[i] === best);
    const holder = ss.length >= 2 && leaders.length === 1 ? leaders[0].id : null;
    st.holder.set(h, holder);
    const hi = holder ? ss.findIndex((x) => x.id === holder) : -1;
    const mult = isDoubleHole(game, h) ? 2 : 1;
    ss.forEach((side, i) => {
      const b = hi >= 0 && i !== hi && scores[i]! < scores[hi]! ? -mult : 0;
      if (b) st.bonus.set(`${side.id}:${h}`, b);
      st.totals.set(side.id, tot[i] + scores[i]! + b);
    });
    st.upTo = h;
  }
  return st;
}

/** Strokes the Crown took off this side (player or team) on this hole: 0, −1 or −2. */
export function crownBonus(game: Game, sideId: string, hole: number): number {
  if (!crownOn(game)) return 0;
  return crownState(game, hole).bonus.get(`${sideId}:${hole}`) ?? 0;
}

/** Who wore the crown on this hole (a player, or a team in 2v2), once the holes before it are finished. */
export function crownHolder(game: Game, hole: number): string | null {
  if (!crownOn(game)) return null;
  const st = crownState(game, hole - 1);
  if (hole === 0) return null;
  if (st.upTo < hole - 1) return null;
  // The holder is set when the hole itself is worked out; before that, work it out from the totals.
  if (st.holder.has(hole)) return st.holder.get(hole) ?? null;
  const ss = sides(game);
  const tot = ss.map((side) => st.totals.get(side.id) ?? 0);
  const best = Math.min(...tot);
  const leaders = ss.filter((_, i) => tot[i] === best);
  return ss.length >= 2 && leaders.length === 1 ? leaders[0].id : null;
}

/**
 * What the strokes alone say about this card.
 * 'made' / 'missed' when the strokes settle it, null when a player has to call it.
 * lastToPar: the player's score against par on their last hole (for cards judged against it).
 */
export function judgeFromStrokes(card: CardDef, par: Par, strokes: number, lastToPar: number | null = null): 'made' | 'missed' | null {
  if (card.vsLastHole) {
    const { by, first } = card.vsLastHole;
    return strokes - par <= (lastToPar == null ? first : lastToPar - by) ? 'made' : 'missed';
  }
  if (card.score && strokes - par > card.score.maxToPar) return 'missed';
  const within = card.doneWithin;
  if (within && ((within.strokes != null && strokes <= within.strokes) || (within.toPar != null && strokes - par <= within.toPar))) {
    return 'made';
  }
  return card.score?.decides ? 'made' : null;
}

/** Outcomes a player can tap for this card. Empty when the strokes decide it. */
export function outcomeChoices(card: CardDef): Outcome[] {
  if (card.score?.decides || card.vsLastHole) return [];
  return card.situational ? ['made', 'missed', 'na'] : ['made', 'missed'];
}

/**
 * The challenge result, worked out from the source fields every time
 * (so correcting strokes or par re-judges cards checked from strokes).
 */
export function resolveOutcome(entry: Entry | undefined, par: Par | null, lastToPar: number | null = null): Outcome | null {
  if (!entry || entry.strokes == null || par == null) return null;
  const card = getCard(entry.cardId);
  if (!card) return null;
  // "Didn't happen" beats a strokes check: the condition never applied.
  if (card.situational && entry.outcome === 'na') return 'na';
  const auto = judgeFromStrokes(card, par, entry.strokes, lastToPar);
  if (auto) return auto;
  const claimed = entry.outcome ?? null;
  // A claim the group votes down (more "no way" than "fair") counts as failed.
  if (claimed === 'made' && needsVote(card)) {
    const { fair, unfair } = voteTally(entry);
    if (unfair > fair) return 'missed';
  }
  return claimed;
}

/** Is this player's claim on the hole open to a group vote? */
export function isVoteable(game: Game, playerId: string, hole: number): boolean {
  const entry = getEntry(game, playerId, hole);
  const par = game.holes[hole]?.par;
  const card = getCard(entry?.cardId);
  if (!entry || !card || entry.strokes == null || par == null || !needsVote(card)) return false;
  return entry.outcome === 'made' && !judgeFromStrokes(card, par, entry.strokes);
}

/**
 * Has this player entered their own score for the hole, with their own result settled?
 * (In a team game a player's hole result also waits on their partner, so use this to ask
 * whether this player still has something to enter.)
 */
export function playerScored(game: Game, playerId: string, hole: number): boolean {
  if (isV2(game)) {
    // Your part is done once your strokes (and any tap the card needs) are in; a card about a friend
    // may still be waiting on them.
    const e = getEntry(game, playerId, hole);
    const card = getCard(e?.cardId);
    if (!e || !card || e.strokes == null) return false;
    return tapChoices(game, card, e.tier).length === 0 || judgeAuto(game, playerId, hole, e.strokes) != null || e.outcome != null;
  }
  return resolveOutcome(getEntry(game, playerId, hole), game.holes[hole]?.par ?? null, lastHoleToPar(game, playerId, hole)) != null;
}

/** Where a player is on the current hole: still out there, finished, or scored. */
export function holeStatus(game: Game, playerId: string, hole: number): 'playing' | 'done' | 'scored' {
  if (playerScored(game, playerId, hole)) return 'scored';
  return getEntry(game, playerId, hole)?.done ? 'done' : 'playing';
}

/** Has this player used their redraw this round? */
export function redrawUsed(game: Game, playerId: string): boolean {
  // In a team game the redraw belongs to the team: one between the partners.
  const ids = [playerId, mateOf(game, playerId)].filter((id): id is string => Boolean(id));
  return game.holes.some((_, h) => ids.some((id) => getEntry(game, id, h)?.redrawn));
}

/** Has this player used their free shot this round? */
export function freePassUsed(game: Game, playerId: string): boolean {
  return game.holes.some((_, h) => getEntry(game, playerId, h)?.freePass);
}

export interface HoleResult {
  tier: Tier;
  cardId: string;
  strokes: number;
  outcome: Outcome;
  adjustment: number;
  /** strokes + adjustment. May go below zero; never clamped. */
  gameScore: number;
  par: Par;
  /** gameScore against par: negative = under. */
  toPar: number;
  /** Played on a double-stakes hole. */
  doubled: boolean;
  /** Played with the free shot. */
  freePass: boolean;
  /** Used a mulligan on this hole. */
  mulligan: boolean;
  /**
   * This player's own result. In a team game `outcome` is the team's (made if either partner
   * made it), so a failed partner still shows ✓ with `ownOutcome` 'missed'.
   */
  ownOutcome: Outcome;
  /**
   * Ruleset 2: a streak card picked on this hole. running = still going; otherwise the hole that
   * settled it, whose result carries the payout (so it lands on the standings when it happens).
   */
  streak?: { outcome: 'made' | 'missed' | 'running'; at: number };
  /** Ruleset 2: strokes on top of the card, already in gameScore: streak payouts and the Crown. */
  extras: HoleExtra[];
}

export interface HoleExtra {
  kind: 'crown' | 'streak';
  amount: number;
  /** streak: the card and the hole it was picked on. */
  cardId?: string;
  from?: number;
}

/** Full result for one player on one hole, or null if it isn't finished yet. */
export function holeResult(game: Game, playerId: string, hole: number): HoleResult | null {
  const base = baseHoleResult(game, playerId, hole);
  if (!base || game.teams) return base; // in 2v2 the Crown goes on the team (unitHoleResult)
  const crown = crownBonus(game, playerId, hole);
  if (!crown) return base;
  return {
    ...base,
    gameScore: base.gameScore + crown,
    toPar: base.toPar + crown,
    extras: [...base.extras, { kind: 'crown', amount: crown }],
  };
}

/** The hole result without the Crown (which needs everyone's results on the holes before). */
export function baseHoleResult(game: Game, playerId: string, hole: number): HoleResult | null {
  if (!isV2(game)) return legacyHoleResult(game, playerId, hole);
  return cached(game, `r:${playerId}:${hole}`, () => v2HoleResult(game, playerId, hole));
}

function v2HoleResult(game: Game, playerId: string, hole: number): HoleResult | null {
  const entry = getEntry(game, playerId, hole);
  const par = game.holes[hole]?.par ?? null;
  const card = getCard(entry?.cardId);
  if (!entry || !entry.tier || !card || entry.strokes == null || par == null) return null;
  const own = cardOutcome(game, playerId, hole);
  if (own == null) return null;
  const mate = mateOf(game, playerId);
  const ownOutcome: Outcome = own === 'running' ? 'na' : own;
  let outcome: Outcome | null = ownOutcome;
  if (mate) {
    const m = cardOutcome(game, mate, hole);
    outcome = teamResolve(ownOutcome, m === 'running' ? 'na' : m);
  }
  if (outcome == null) return null;
  const streak = card.multi ? (streakResult(game, playerId, hole) ?? undefined) : undefined;
  // A streak card counts nothing on its own hole unless it was settled there.
  const adjustment =
    card.multi && (!streak || streak.at !== hole || streak.outcome === 'running') ? 0 : stakeFor(game, hole, entry.tier, outcome);
  const extras: HoleExtra[] = [];
  // Streaks picked on an earlier hole and settled on this one pay out here.
  for (let s = Math.max(0, hole - MULTI_HOLES + 1); s < hole; s++) {
    const e = getEntry(game, playerId, s);
    if (!getCard(e?.cardId)?.multi || !e?.tier) continue;
    const r = streakResult(game, playerId, s);
    if (r && r.outcome !== 'running' && r.at === hole)
      extras.push({ kind: 'streak', amount: stakeFor(game, s, e.tier, r.outcome), cardId: e.cardId, from: s });
  }
  const extra = extras.reduce((a, x) => a + x.amount, 0);
  return {
    tier: entry.tier,
    cardId: card.id,
    strokes: entry.strokes,
    outcome,
    adjustment,
    gameScore: entry.strokes + adjustment + extra,
    par,
    toPar: entry.strokes + adjustment + extra - par,
    doubled: isDoubleHole(game, hole),
    freePass: false,
    mulligan: Boolean(entry.mulligan),
    ownOutcome,
    ...(streak ? { streak } : {}),
    extras,
  };
}

function legacyHoleResult(game: Game, playerId: string, hole: number): HoleResult | null {
  const entry = getEntry(game, playerId, hole);
  const par = game.holes[hole]?.par ?? null;
  const own = resolveOutcome(entry, par, lastHoleToPar(game, playerId, hole));
  const mate = mateOf(game, playerId);
  const outcome = mate ? teamResolve(own, resolveOutcome(getEntry(game, mate, hole), par, lastHoleToPar(game, mate, hole))) : own;
  if (!entry || !entry.tier || !entry.cardId || entry.strokes == null || outcome == null) return null;
  const adjustment = stakeFor(game, hole, entry.tier, outcome, entry.freePass);
  return {
    tier: entry.tier,
    cardId: entry.cardId,
    strokes: entry.strokes,
    outcome,
    adjustment,
    gameScore: entry.strokes + adjustment,
    par: par!,
    toPar: entry.strokes + adjustment - par!,
    doubled: isDoubleHole(game, hole),
    freePass: Boolean(entry.freePass),
    mulligan: Boolean(entry.mulligan),
    ownOutcome: own ?? outcome,
    extras: [],
  };
}

/** Has this player got a card (or a hidden pick) for the hole? */
export function hasPicked(entry: Entry | undefined): boolean {
  return Boolean(entry && (entry.tier || entry.hidden));
}

export function holeComplete(game: Game, hole: number): boolean {
  return game.players.length > 0 && game.players.every((p) => baseHoleResult(game, p.id, hole) !== null);
}

export function allPicked(game: Game, hole: number): boolean {
  return game.players.every((p) => {
    const e = getEntry(game, p.id, hole);
    return Boolean(e && (e.cardId || e.hidden));
  });
}

/** Has any card been drawn on this hole? */
export function anyPicked(game: Game, hole: number): boolean {
  return game.players.some((p) => hasPicked(getEntry(game, p.id, hole)));
}

/** New players can join until the first hole is finished. */
export function canAddPlayers(game: Game): boolean {
  if (game.status === 'lobby') return true;
  return game.status === 'playing' && game.current === 0 && !holeComplete(game, 0);
}

// ── Who can change a score ──────────────────────────────────────────────────

/** This device runs that player: it claimed them, or they're a guest on the host's phone. */
export function ownsPlayer(game: Game, deviceId: string, playerId: string): boolean {
  const p = game.players.find((x) => x.id === playerId);
  if (!p) return false;
  return p.deviceId === deviceId || (p.deviceId === null && deviceId === game.hostDeviceId);
}

/** A hole is locked in once the group has moved past it, or the round is over. */
export function isLocked(game: Game, hole: number): boolean {
  return hole < game.current || game.status === 'finished';
}

/**
 * direct: save it now. request: ask the player (or host) to approve. none: not yours to touch.
 * One-phone games and the host are always direct. Online, you can enter and fix your own
 * score until the group moves on; after that, or for anyone else's score, you ask.
 */
export function scoreAccess(game: Game, deviceId: string, playerId: string, hole: number): 'direct' | 'request' | 'none' {
  if (!game.code || deviceId === game.hostDeviceId) return 'direct';
  const mine = ownsPlayer(game, deviceId, playerId);
  if (mine && !isLocked(game, hole)) return 'direct';
  return getEntry(game, playerId, hole)?.strokes != null ? 'request' : 'none';
}

/** The player whose score it is approves; if they asked themselves, the host does. The host can always. */
export function canApproveFix(game: Game, deviceId: string, fix: FixRequest): boolean {
  if (deviceId === game.hostDeviceId) return true;
  if (fix.by === deviceId) return false;
  return ownsPlayer(game, deviceId, fix.playerId);
}

/** Requests waiting on this phone's answer. */
export function fixesToAnswer(game: Game, deviceId: string): FixRequest[] {
  return (game.fixes ?? []).filter((f) => f.by !== deviceId && canApproveFix(game, deviceId, f));
}

// ── Mulligans ────────────────────────────────────────────────────────────────

/** Mulligans each player gets: 2 for 9 holes or fewer, 4 for longer rounds, none when switched off. */
export function mulliganAllowance(game: Pick<Game, 'holes' | 'settings'>): number {
  if (!game.settings.mulligans) return 0;
  return game.holes.length <= 9 ? 2 : 4;
}

export function mulligansUsed(game: Game, playerId: string): number {
  return game.holes.filter((_, i) => getEntry(game, playerId, i)?.mulligan).length;
}

export function mulligansLeft(game: Game, playerId: string): number {
  return Math.max(0, mulliganAllowance(game) - mulligansUsed(game, playerId));
}
