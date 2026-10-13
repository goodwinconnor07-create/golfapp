// App state and every command the screens can run.
// One small store (no library): screens read it with useApp(selector).

import { useSyncExternalStore } from 'react';
import {
  applyAction,
  cleanName,
  CODE_LENGTH,
  createGame,
  cryptoRng,
  holeResult,
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
import { loadDeviceId, loadName, loadSession, saveName, saveSession, type Session } from './persist';
import { freshUi, type HoleUi } from './view';

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
  | { name: 'scorecard' };

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

function setSession(session: Session | null): void {
  saveSession(session);
  const game = predictedGame(session, state.deviceId);
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
}

/** Moves a one-phone game onto the server so friends can join with a code. */
export async function goOnline(): Promise<boolean> {
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
    toast(e instanceof Error ? e.message : "Couldn't start online play.", 'error');
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

export function pickTier(playerId: string, tier: Tier): void {
  const g = state.game;
  if (!g) return;
  if (dispatch({ type: 'pick', playerId, hole: g.current, tier })) {
    set({ ui: { ...state.ui, reveal: playerId } });
    haptic('heavy');
  }
}

export function swapCard(playerId: string): void {
  const g = state.game;
  if (g && dispatch({ type: 'swap', playerId, hole: g.current })) haptic('medium');
}

export function doneReveal(): void {
  set({ ui: { ...state.ui, reveal: null } });
}

export function startScoring(): void {
  set({ ui: { ...state.ui, scoring: true } });
}

/** "Pick for Alex" / "Enter for Alex": this phone steps in for someone this hole. */
export function stepIn(kind: 'pick' | 'score', playerId: string): void {
  const ui = state.ui;
  if (kind === 'pick') set({ ui: { ...ui, extraPick: [...ui.extraPick, playerId] } });
  else set({ ui: { ...ui, scoring: true, extraScore: [...ui.extraScore, playerId] } });
}

export function submitScore(playerId: string, hole: number, strokes: number, outcome?: Outcome, splash = true): boolean {
  if (!dispatch({ type: 'score', playerId, hole, strokes, outcome })) return false;
  const g = state.game;
  const r = g ? holeResult(g, playerId, hole) : null;
  if (r) {
    haptic(r.outcome === 'made' ? 'success' : r.outcome === 'missed' ? 'error' : 'light');
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
  if (code.length === CODE_LENGTH) {
    if (s?.mode === 'online' && s.code === code) resetTo({ name: 'game' });
    else resetTo({ name: 'join', code });
  } else if (s?.game && s.game.status !== 'finished') {
    resetTo({ name: 'game' });
  }
  if (s?.mode === 'online' && s.code) connect(s.code);

  checkServer().then((ok) => set({ server: ok ? 'up' : 'down' }));
}
