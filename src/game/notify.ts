// Which phones get a push notification after an action, and what it says. Pure, so the server
// (worker/room.ts) and the tests share it. Only moments worth a buzz in your pocket on a golf
// course: the round starting, a hole's results being in, a vote on your call, and a score fix
// waiting on your answer. The phone that did the action is never notified.

import { getCard } from './cards';
import { canApproveFix, getEntry, holeComplete, isVoteable, ownsPlayer } from './rules';
import type { Action, Game } from './types';

export interface Note {
  /** Phones to tell. */
  devices: string[];
  title: string;
  body: string;
}

/** Every phone in the game: the host's and any that have claimed a player. */
function devicesIn(game: Game): string[] {
  const set = new Set<string>([game.hostDeviceId]);
  for (const p of game.players) if (p.deviceId) set.add(p.deviceId);
  return [...set];
}

export function notesFor(before: Game, after: Game, action: Action, actor: string): Note[] {
  const others = devicesIn(after).filter((d) => d !== actor);
  if (others.length === 0) return [];
  const title = after.course || 'CardShot';
  const holeNo = (h: number) => after.holes[h]?.number ?? h + 1;
  const notes: Note[] = [];

  // The host tapped Let's go.
  if (before.status === 'lobby' && after.status === 'playing') {
    const host = after.players.find((p) => p.deviceId === after.hostDeviceId)?.name ?? 'The host';
    notes.push({ devices: others, title, body: `${host} started the round. Pick your card for hole ${holeNo(after.current)}.` });
  }

  if (action.type === 'score') {
    const h = action.hole;
    // The last score of the hole is in: everyone else can see the results.
    if (!holeComplete(before, h) && holeComplete(after, h)) {
      notes.push({ devices: others, title, body: `Hole ${holeNo(h)} results are in. See who moved up.` });
    }
    // A claim judged by eye: the other players vote on it.
    if (isVoteable(after, action.playerId, h) && !isVoteable(before, action.playerId, h)) {
      const player = after.players.find((p) => p.id === action.playerId);
      const card = getCard(getEntry(after, action.playerId, h)?.cardId);
      const voters = others.filter((d) => after.players.some((p) => p.id !== action.playerId && ownsPlayer(after, d, p.id)));
      if (player && voters.length) {
        notes.push({
          devices: voters,
          title,
          body: `${player.name} says they completed ${card ? `"${card.title}"` : 'their card'}. Fair? Vote now.`,
        });
      }
    }
  }

  // Someone wants a locked-in score changed: tell whoever approves it.
  if (action.type === 'requestFix') {
    const fix = after.fixes?.find((f) => f.id === action.id);
    if (fix) {
      const own = ownsPlayer(after, fix.by, fix.playerId);
      const whose = own ? 'their' : `${after.players.find((p) => p.id === fix.playerId)?.name ?? 'a player'}'s`;
      const approvers = others.filter((d) => canApproveFix(after, d, fix));
      if (approvers.length) {
        notes.push({ devices: approvers, title, body: `${fix.byName} wants to change ${whose} score on hole ${holeNo(fix.hole)}.` });
      }
    }
  }

  return notes;
}
