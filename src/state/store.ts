// App state and every command the screens can run.
// One small store (no library): screens read it with useApp(selector).

import { useSyncExternalStore } from 'react';
import {
  applyAction,
  cleanName,
  CODE_LENGTH,
  createGame,
  drawCard,
  getCard,
  getEntry,
  cryptoRng,
  holeResult,
  standings,
  newId,
  normalizeCode,
  type Action,
  type CourseDetail,
  type Game,
  type GameInfo,
  type Hole,
  type Outcome,
  type ServerMessage,
  type Tier,
} from '../game';
import { haptic } from '../ui/effects';
import { checkServer, createOnlineGame } from './api';
import { Connection, type ConnStatus } from './connection';
import {
  clearHistory as clearSavedHistory,
  loadDeviceId,
  loadName,
  loadSession,
  saveName,
  saveRecord,
  saveSession,
  type Session,
} from './persist';
import { freshUi, myPlayers, type HoleUi } from './view';

export type Route =
  | { name: 'home' }
  | { name: 'howto' }
  | { name: 'setupPlayers' }
  | { name: 'setupCourse' }
  | { name: 'setupHoles' }
  | { name: 'join'; code?: string }
  | { name: 'joinWho'; info: GameInfo }
  | { name: 'game' }
  | { name: 'leaderboard' }
  | { name: 'scorecard' }
  | { name: 'history' };

export type Sheet =
  | { name: 'invite' }
  | { name: 'options' }
  | { name: 'menu' }
  | { name: 'pars' }
  | { name: 'player'; playerId: string }
  | { name: 'edit'; playerId: string; hole: number }
  | { name: 'confirm'; title: string; body?: string; confirm: string; danger?: boolean; onConfirm: () => void };

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}

/** The big result splash after a score is entered. */
export interface Flash {
  key: number;
  name: string;
  tier: Tier;
  outcome: Outcome;
  strokes: number;
  delta: number;
  gameScore: number;
  par: number;
  doubled: boolean;
  freePass: boolean;
  /** The challenge the stamp lands on. */
  cardTitle?: string;
}

export interface AppState {
  deviceId: string;
  profileName: string;
  stack: Route[];
  sheet: Sheet | null;
  session: Session | null;
  /** The game as this phone should show it (online: server state plus unconfirmed actions). */
  game: Game | null;
  conn: ConnStatus | 'none';
  server: 'unknown' | 'up' | 'down';
  ui: HoleUi;
  toasts: Toast[];
  flash: Flash | null;
  /** Setup in progress: player names and the chosen course (null = no course picked). */
  draft: { names: string[]; course: CourseDetail | null };
  busy: string | null;
}

// ── Store core ──────────────────────────────────────────────────────────────

const ROOT: Route = { name: 'home' };
const listeners = new Set<() => void>();

function predictedGame(session: Session | null, deviceId: string): Game | null {
  if (!session?.game) return null;
  if (session.mode === 'local' || session.pending.length === 0) return session.game;
  let game = session.game;
  for (const p of session.pending) {
    const r = applyAction(game, p.action, { deviceId, now: Date.now(), rng: Math.random, predict: true });
    if (r.ok) game = r.game;
  }
  return game;
}

const bootDevice = loadDeviceId();
const bootSession = loadSession();
const bootGame = predictedGame(bootSession, bootDevice);

let state: AppState = {
  deviceId: bootDevice,
  profileName: loadName(),
  stack: [ROOT],
  sheet: null,
  session: bootSession,
  game: bootGame,
  conn: 'none',
  server: 'unknown',
  ui: freshUi(bootGame),
  toasts: [],
  flash: null,
  draft: { names: [''], course: null },
  busy: null,
};

function set(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getState(): AppState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Read from the store. The selector must return stored values, not build new objects. */
export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

// ── Navigation (kept in step with the phone's back button) ─────────────────

let guarded = false;
let ignoreNextPop = false;

const atRoot = () => state.stack.length === 1 && !state.sheet;

/** While away from Home, one extra history entry catches the back gesture so it moves within the app. */
function syncHistory(): void {
  try {
    if (!atRoot() && !guarded) {
      history.pushState({ sendit: true }, '');
      guarded = true;
    } else if (atRoot() && guarded) {
      guarded = false;
      ignoreNextPop = true;
      history.back();
    }
  } catch {
    // Some embedded browsers block history changes. In-app back buttons still work.
  }
}

function onPopState(): void {
  if (ignoreNextPop) {
    ignoreNextPop = false;
    return;
  }
  guarded = false;
  back();
}

export function navigate(route: Route): void {
  set({ stack: [...state.stack, route], sheet: null });
  syncHistory();
}

export function resetTo(...routes: Route[]): void {
  set({ stack: [ROOT, ...routes], sheet: null });
  syncHistory();
}

export function back(): void {
  if (state.sheet) set({ sheet: null });
  else if (state.stack.length > 1) set({ stack: state.stack.slice(0, -1) });
  syncHistory();
}

export function openSheet(sheet: Sheet): void {
  set({ sheet });
  syncHistory();
}

export function closeSheet(): void {
  if (!state.sheet) return;
  set({ sheet: null });
  syncHistory();
}

export function confirm(opts: Omit<Extract<Sheet, { name: 'confirm' }>, 'name'>): void {
  openSheet({ name: 'confirm', ...opts });
}

// ── Toasts and splashes ─────────────────────────────────────────────────────

let toastSeq = 0;

export function toast(text: string, kind: Toast['kind'] = 'info'): void {
  const t: Toast = { id: ++toastSeq, text, kind };
  set({ toasts: [...state.toasts.slice(-2), t] });
  setTimeout(() => set({ toasts: state.toasts.filter((x) => x.id !== t.id) }), kind === 'error' ? 4500 : 2800);
}

export function clearFlash(): void {
  if (state.flash) set({ flash: null });
}

// ── Session ─────────────────────────────────────────────────────────────────

let conn: Connection | null = null;

/** Keeps a summary of every finished round on this phone, for the History screen. */
function recordIfFinished(game: Game | null): void {
  if (game?.status !== 'finished') return;
  const rows = standings(game);
  if (!rows.some((r) => r.totals.holes > 0)) return;
  saveRecord({
    id: game.id,
    finishedAt: game.updatedAt,
    course: game.course,
    // Holes actually played: a round can be finished early.
    holes: Math.max(...rows.map((r) => r.totals.holes)),
    players: rows.map((r) => ({
      name: r.player.name,
      color: r.player.color,
      rank: r.rank,
      toPar: r.totals.toPar,
      strokes: r.totals.real,
    })),
  });
}

export function clearHistory(onCleared: () => void): void {
  confirm({
    title: 'Clear past games?',
    body: 'This removes every saved round from this phone.',
    confirm: 'Clear',
    danger: true,
    onConfirm: () => {
      clearSavedHistory();
      onCleared();
    },
  });
}

function setSession(session: Session | null): void {
  saveSession(session);
  const game = predictedGame(session, state.deviceId);
  recordIfFinished(game);
  let ui = state.ui;
  if (!game || ui.gameId !== game.id || ui.hole !== game.current) ui = freshUi(game);
  set({ session, game, ui });
}

function closeConnection(): void {
  conn?.close();
  conn = null;
  set({ conn: 'none' });
}

function onServerMessage(msg: ServerMessage): void {
  const s = state.session;
  if (!s || s.mode !== 'online') return;
  if (msg.t === 'state') {
    const pending = msg.ack ? s.pending.filter((p) => p.id !== msg.ack) : s.pending;
    setSession({ ...s, game: msg.game, pending });
  } else if (msg.t === 'reject') {
    setSession({ ...s, pending: s.pending.filter((p) => p.id !== msg.id) });
    toast(msg.error, 'error');
    haptic('error');
  }
}

function connect(code: string): void {
  closeConnection();
  set({ conn: 'connecting' });
  conn = new Connection(code, state.deviceId, {
    onMessage: onServerMessage,
    onStatus: (status) => set({ conn: status }),
    onOpen: () => {
      const s = state.session;
      if (s?.mode !== 'online') return;
      for (const p of s.pending) conn?.send({ t: 'act', id: p.id, a: p.action });
    },
    onGone: (message) => {
      const s = state.session;
      closeConnection();
      if (s?.game) {
        // Keep what we have on this phone so nobody loses their round.
        setSession({ mode: 'local', code: null, game: { ...s.game, code: null, hostDeviceId: state.deviceId }, pending: [] });
        toast(`${message} It's saved on this phone.`, 'error');
      } else {
        setSession(null);
        resetTo();
        toast(message, 'error');
      }
    },
  });
}

/** Apply an action: straight away on a one-phone game, through the server online. */
export function dispatch(action: Action): boolean {
  const s = state.session;
  if (!s) return false;
  if (s.mode === 'local') {
    if (!s.game) return false;
    if (state.busy) {
      // The game is being uploaded for online play; a change now would be lost.
      toast('One second, getting your code…');
      return false;
    }
    const r = applyAction(s.game, action, { deviceId: state.deviceId, now: Date.now(), rng: cryptoRng });
    if (!r.ok) {
      toast(r.error, 'error');
      haptic('error');
      return false;
    }
    if (r.changed) setSession({ ...s, game: r.game });
    return true;
  }

  const base = state.game;
  if (base) {
    // Check it locally first so mistakes show up instantly, even offline.
    const r = applyAction(base, action, { deviceId: state.deviceId, now: Date.now(), rng: Math.random, predict: true });
    if (!r.ok) {
      toast(r.error, 'error');
      haptic('error');
      return false;
    }
  }
  const id = newId(10);
  setSession({ ...s, pending: [...s.pending, { id, action }] });
  conn?.send({ t: 'act', id, a: action });
  return true;
}

// ── Commands used by the screens ────────────────────────────────────────────

export function setDraftNames(names: string[]): void {
  set({ draft: { ...state.draft, names } });
}

export function startNewGame(): void {
  const begin = () => {
    set({ draft: { names: [state.profileName], course: null } });
    resetTo({ name: 'setupPlayers' });
  };
  const g = state.game;
  if (g && g.status !== 'finished') {
    confirm({
      title: 'Start a new game?',
      body: "You'll leave the round you're in now.",
      confirm: 'New game',
      danger: true,
      onConfirm: begin,
    });
  } else begin();
}

export function setDraftCourse(course: CourseDetail | null): void {
  set({ draft: { ...state.draft, course } });
}

/** Fills in each hole's par from the chosen course, matched by hole number. */
export function withCoursePars(holes: Hole[], course: CourseDetail | null): Hole[] {
  if (!course?.pars.length) return holes;
  return holes.map((h) => ({ ...h, par: course.pars[h.number - 1] ?? h.par }));
}

export function createLocalGame(holes: Hole[]): void {
  const names = state.draft.names.map(cleanName).filter(Boolean);
  const course = state.draft.course;
  if (names.length === 0) return;
  saveName(names[0]);
  closeConnection();
  const game = createGame({
    id: newId(12),
    hostDeviceId: state.deviceId,
    now: Date.now(),
    players: names.map((name) => ({ id: newId(12), name })),
    holes: withCoursePars(holes, course),
    course: course?.name,
  });
  set({ profileName: names[0] });
  setSession({ mode: 'local', code: null, game, pending: [] });
  resetTo({ name: 'game' });
  // Invite-first: get a join code right away. With no signal the lobby offers to try again.
  if (state.server !== 'down') void goOnline(true);
}

/** Moves a one-phone game onto the server so friends can join with a code. */
export async function goOnline(quiet = false): Promise<boolean> {
  const s = state.session;
  if (!s?.game) return false;
  if (s.mode === 'online') return true;
  if (state.busy) return false;
  set({ busy: 'Getting a code…' });
  try {
    const code = await createOnlineGame(state.deviceId, s.game);
    set({ server: 'up' });
    setSession({ mode: 'online', code, game: { ...s.game, code }, pending: [] });
    connect(code);
    return true;
  } catch (e) {
    if (!quiet) toast(e instanceof Error ? e.message : "Couldn't start online play.", 'error');
    return false;
  } finally {
    set({ busy: null });
  }
}

/** Join someone's online game, as an existing player or as someone new. */
export function joinGame(info: GameInfo, choice: { playerId: string } | { name: string }): void {
  const current = state.game;
  if (current && current.status !== 'finished' && state.session?.code !== info.code) {
    confirm({
      title: 'Leave your current game?',
      body: "Joining this game closes the round you're playing on this phone.",
      confirm: 'Join anyway',
      danger: true,
      onConfirm: () => {
        setSession(null);
        joinGame(info, choice);
      },
    });
    return;
  }
  let action: Action;
  if ('playerId' in choice) {
    action = { type: 'claimPlayer', playerId: choice.playerId };
    const name = info.players.find((p) => p.id === choice.playerId)?.name;
    if (name) saveName(name);
  } else {
    const name = cleanName(choice.name);
    if (!name) return;
    action = { type: 'addPlayer', id: newId(12), name, claim: true };
    saveName(name);
    set({ profileName: name });
  }
  closeConnection();
  setSession({ mode: 'online', code: info.code, game: null, pending: [{ id: newId(10), action }] });
  connect(info.code);
  resetTo({ name: 'game' });
}

/** Leave an online game on this phone. Your players go back to the host so they can finish your scores. */
export function leaveGame(): void {
  const g = state.game;
  if (state.session?.mode === 'online' && g && g.hostDeviceId !== state.deviceId) {
    for (const p of g.players) {
      if (p.deviceId === state.deviceId) conn?.send({ t: 'act', id: newId(10), a: { type: 'releasePlayer', playerId: p.id } });
    }
  }
  closeConnection();
  setSession(null);
  resetTo();
}

/**
 * With no signal in an online game, the phone deals the card itself so play can go on.
 * The server keeps that card when it syncs, unless someone else got it first.
 */
function dealOffline(g: Game, tier: Tier, exclude?: string, force = false, noBunker = true): string | undefined {
  if (state.session?.mode !== 'online' || (state.conn === 'open' && !force)) return undefined;
  try {
    return drawCard(structuredClone(g), tier, g.current, Math.random, exclude ? { exclude: [exclude], noBunker } : {});
  } catch {
    return undefined;
  }
}

/** How long to wait for the server's card before the phone deals one. */
const CARD_WAIT_MS = 4000;

/**
 * Signal can die without the link noticing for a while. If the server's card hasn't
 * arrived after a few seconds, deal one on the phone and put it on the waiting pick,
 * so the player isn't stuck. If the server did get the pick, its card wins.
 */
function dealIfStuck(playerId: string, hole: number, tier: Tier): void {
  setTimeout(() => {
    const s = state.session;
    const g = state.game;
    if (s?.mode !== 'online' || !g || g.current !== hole || getEntry(g, playerId, hole)?.cardId) return;
    const i = s.pending.findIndex((p) => p.action.type === 'pick' && p.action.playerId === playerId && p.action.hole === hole);
    if (i === -1) return;
    const cardId = dealOffline(g, tier, undefined, true);
    if (!cardId) return;
    const pending = [...s.pending];
    const before = pending[i].action;
    // Keep the rest of the pick (like a free shot) and just add the card.
    if (before.type === 'pick') pending[i] = { ...pending[i], action: { ...before, cardId } };
    setSession({ ...s, pending });
  }, CARD_WAIT_MS);
}

export function pickTier(playerId: string, tier: Tier, freePass = false): void {
  const g = state.game;
  if (!g) return;
  const cardId = dealOffline(g, tier);
  if (dispatch({ type: 'pick', playerId, hole: g.current, tier, ...(cardId ? { cardId } : {}), ...(freePass ? { freePass } : {}) })) {
    if (!cardId) dealIfStuck(playerId, g.current, tier);
    set({ ui: { ...state.ui, reveal: playerId } });
    haptic('heavy');
  }
}

export function swapCard(playerId: string): void {
  const g = state.game;
  if (!g) return;
  const entry = getEntry(g, playerId, g.current);
  const cardId = entry?.tier ? dealOffline(g, entry.tier, entry.cardId) : undefined;
  if (dispatch({ type: 'swap', playerId, hole: g.current, ...(cardId ? { cardId } : {}) })) haptic('medium');
}

/** Swap your card for another from the same tier. Once per player per round. */
export function redrawCard(playerId: string): void {
  const g = state.game;
  if (!g) return;
  const entry = getEntry(g, playerId, g.current);
  const cardId = entry?.tier ? dealOffline(g, entry.tier, entry.cardId, false, false) : undefined;
  if (dispatch({ type: 'redraw', playerId, hole: g.current, ...(cardId ? { cardId } : {}) })) haptic('medium');
}

/** Call someone's judged-by-eye claim fair or not. */
export function castVote(playerId: string, voterId: string, fair: boolean): void {
  const g = state.game;
  if (g && dispatch({ type: 'vote', playerId, hole: g.current, voterId, fair })) haptic(fair ? 'light' : 'medium');
}

const REVEALED_KEY = 'sendit.revealed';

/** Has this phone already shown the group reveal for this hole? (Survives a reload.) */
export function groupRevealSeen(gameId: string, hole: number): boolean {
  try {
    return localStorage.getItem(REVEALED_KEY) === `${gameId}:${hole}`;
  } catch {
    return false;
  }
}

export function doneGroupReveal(): void {
  const g = state.game;
  if (!g) return;
  try {
    localStorage.setItem(REVEALED_KEY, `${g.id}:${g.current}`);
  } catch {
    // Storage blocked: the reveal may replay after a reload, which is harmless.
  }
  set({ ui: { ...state.ui, groupShown: true } });
}

export function doneReveal(): void {
  set({ ui: { ...state.ui, reveal: null } });
}

/** "Hole done": online, tell everyone this phone's players have finished the hole. */
export function startScoring(): void {
  const g = state.game;
  let scoreFor: string | null = null;
  if (g && state.session?.mode === 'online') {
    const mine = myPlayers(g, state.deviceId, true);
    for (const p of mine) {
      if (!getEntry(g, p.id, g.current)?.done) dispatch({ type: 'holeDone', playerId: p.id, hole: g.current });
    }
    // Straight to your score: the waiting room comes after it.
    scoreFor = mine.find((p) => !holeResult(g, p.id, g.current))?.id ?? null;
  }
  set({ ui: { ...state.ui, scoring: true, scoreFor } });
}

/** Online with players on other phones: scoring goes through the waiting room and a shared reveal. */
function inRoom(g: Game): boolean {
  if (state.session?.mode !== 'online') return false;
  const mine = myPlayers(g, state.deviceId, true);
  return g.players.some((p) => !mine.includes(p));
}

/** From the waiting room: enter this player's score now. */
export function enterScoreFor(playerId: string): void {
  set({ ui: { ...state.ui, scoring: true, scoreFor: playerId } });
}

const RESULTS_KEY = 'sendit.resultsRevealed';

export function resultsRevealSeen(gameId: string, hole: number): boolean {
  try {
    return localStorage.getItem(RESULTS_KEY) === `${gameId}:${hole}`;
  } catch {
    return false;
  }
}

/** The reveal has played on this phone: after a reload, go straight to the standings. */
export function markResultsRevealed(): void {
  const g = state.game;
  if (!g) return;
  try {
    localStorage.setItem(RESULTS_KEY, `${g.id}:${g.current}`);
  } catch {
    // Storage blocked: the reveal may replay after a reload, which is harmless.
  }
}

/** "Pick for them": this phone picks for someone else this hole (say their phone died). */
export function stepIn(playerId: string): void {
  set({ ui: { ...state.ui, extraPick: [...state.ui.extraPick, playerId] } });
}

export function submitScore(playerId: string, hole: number, strokes: number, outcome?: Outcome, splash = true): boolean {
  if (!dispatch({ type: 'score', playerId, hole, strokes, outcome })) return false;
  const g = state.game;
  // Next of this phone's players to score, or back to the waiting room.
  if (state.ui.scoreFor === playerId) {
    const next = g ? myPlayers(g, state.deviceId, true).find((p) => p.id !== playerId && !holeResult(g, p.id, hole)) : undefined;
    set({ ui: { ...state.ui, scoreFor: next?.id ?? null } });
  }
  // The shared results reveal shows everyone's result, so skip the splash there.
  if (g && inRoom(g)) splash = false;
  const r = g ? holeResult(g, playerId, hole) : null;
  if (r) {
    // With a splash, the buzz comes when the stamp lands instead.
    if (!splash) haptic(r.outcome === 'made' ? 'success' : r.outcome === 'missed' ? 'error' : 'light');
    if (splash) {
      const name = g?.players.find((p) => p.id === playerId)?.name ?? '';
      set({
        flash: {
          key: Date.now(),
          name,
          tier: r.tier,
          outcome: r.outcome,
          strokes: r.strokes,
          delta: r.adjustment,
          gameScore: r.gameScore,
          par: r.par,
          doubled: r.doubled,
          freePass: r.freePass,
          cardTitle: g ? getCard(getEntry(g, playerId, hole)?.cardId)?.title : undefined,
        },
      });
    }
  }
  return true;
}

export function nextHole(): void {
  const g = state.game;
  if (g && dispatch({ type: 'nextHole', from: g.current })) haptic('medium');
}

// ── Start-up ────────────────────────────────────────────────────────────────

/** Reads join links (/j/CODE), resumes any game in progress and checks the server. */
export function boot(): void {
  window.addEventListener('popstate', onPopState);

  const path = location.pathname.match(/^\/j\/([A-Za-z]+)\/?$/);
  const code = normalizeCode(path?.[1] ?? new URLSearchParams(location.search).get('join') ?? '');
  try {
    history.scrollRestoration = 'manual';
    if (path || location.search) history.replaceState(null, '', '/');
  } catch {
    // History is locked down here; nothing to tidy.
  }

  const s = state.session;
  // A round finished before Past games existed (or before this visit) still gets saved.
  recordIfFinished(state.game);
  if (code.length === CODE_LENGTH) {
    if (s?.mode === 'online' && s.code === code) resetTo({ name: 'game' });
    else resetTo({ name: 'join', code });
  } else if (s?.game && s.game.status !== 'finished') {
    resetTo({ name: 'game' });
  }
  if (s?.mode === 'online' && s.code) connect(s.code);

  void recheckServer();
  // Signal comes and goes on a course: notice when the server is reachable again.
  window.addEventListener('online', () => void recheckServer());
  setInterval(() => {
    if (state.server === 'down' && document.visibilityState === 'visible') void recheckServer();
  }, 20_000);
}

/** Checks the server; when it comes back, a game made with no signal gets its invite code. */
async function recheckServer(): Promise<void> {
  const ok = await checkServer();
  const was = state.server;
  set({ server: ok ? 'up' : 'down' });
  const s = state.session;
  if (ok && was !== 'up' && s?.mode === 'local' && s.game?.status === 'lobby') void goOnline(true);
}
