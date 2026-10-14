// Which scene each card shows, and the short tag on its final still. Tags sum up the card at a
// glance; the approved pass text on the card itself is unchanged. A new card only needs a line here.

export type ShotKind = 'putt' | 'drive' | 'trouble' | 'approach' | 'bunker' | 'chip' | 'score';

export interface ShotArt {
  kind: ShotKind;
  tag?: string;
  /** putt: the distance on the aim line, in feet. approach: the ring around the flag, in feet. */
  feet?: number;
  /** putt: a lag putt then a tap-in. */
  two?: boolean;
  /** drive: the distance shown where the ball lands. */
  metres?: number;
  /** trouble: what's beside the fairway. */
  hazard?: 'stakes' | 'water' | 'both';
  /** bunker: carry over the sand instead of playing out of it. chip: drop in. */
  miss?: boolean;
  holeOut?: boolean;
  /** score: strokes against par to write on the card (−1 birdie, 0 par, +2 double bogey…). */
  toPar?: number;
}

export const SHOT_ART: Record<string, ShotArt> = {
  // Putting
  S04: { kind: 'putt', two: true, tag: '2 putts max' },
  B04: { kind: 'putt', feet: 6 },
  B12: { kind: 'putt', feet: 8 },
  I03: { kind: 'putt', feet: 12 },
  I11: { kind: 'putt', feet: 10, tag: 'for par' },

  // Off the tee
  S03: { kind: 'drive', tag: 'tee shot · fairway' },
  S11: { kind: 'drive', tag: 'fairway or rough' },
  B03: { kind: 'drive', metres: 170 },
  I08: { kind: 'drive', metres: 200, tag: 'and in the fairway' },
  S15: { kind: 'drive', tag: '2nd shot · fairway' },

  // Staying out of trouble
  S02: { kind: 'trouble', hazard: 'both', tag: 'no penalties' },
  S05: { kind: 'trouble', hazard: 'stakes', tag: 'stay in bounds' },
  S08: { kind: 'trouble', hazard: 'water', tag: 'keep your ball' },

  // Into the green
  B02: { kind: 'approach', feet: 15 },
  I02: { kind: 'approach', feet: 6 },
  B07: { kind: 'approach', feet: 15, tag: 'wedge · 30–80 m' },
  I07: { kind: 'approach', feet: 6, tag: 'wedge · 50 m+' },
  B06: { kind: 'approach', feet: 20, tag: 'par 3 tee shot' },
  I04: { kind: 'approach', feet: 10, tag: 'par 3 tee shot' },
  I14: { kind: 'approach', feet: 6, tag: 'par 3 tee shot' },
  S07: { kind: 'approach', tag: 'par 3 · on the green' },
  S06: { kind: 'approach', tag: 'on in 3' },
  S13: { kind: 'approach', tag: 'on in 4' },
  B05: { kind: 'approach', tag: 'on in par − 1' },
  B09: { kind: 'approach', tag: 'par 4 · on in 2' },
  B13: { kind: 'approach', tag: 'fairway, then on in 2' },
  B08: { kind: 'approach', tag: 'from the rough · on in 3' },
  I05: { kind: 'approach', tag: 'on in 2 · par or better' },
  I09: { kind: 'approach', tag: 'par 5 · on in 3' },
  I15: { kind: 'approach', tag: 'long iron · par or better' },

  // Sand
  B11: { kind: 'bunker', tag: 'out and on in one' },
  I06: { kind: 'bunker', tag: 'up and down for par' },
  S10: { kind: 'bunker', miss: true, tag: 'stay out of the sand' },

  // Around the green
  S09: { kind: 'chip', tag: 'on in one' },
  B14: { kind: 'chip', holeOut: true, tag: 'hole out' },
  I13: { kind: 'chip', holeOut: true, tag: '10 m+ · hole out' },

  // Score
  S01: { kind: 'score', toPar: 2, tag: 'double bogey or better' },
  S12: { kind: 'score', toPar: 3, tag: 'triple bogey or better' },
  B01: { kind: 'score', toPar: 0, tag: 'par or better' },
  B10: { kind: 'score', toPar: 0, tag: 'par or better · no penalties' },
  I01: { kind: 'score', toPar: -1, tag: 'birdie or better' },
  I12: { kind: 'score', toPar: -1, tag: 'birdie · no penalties' },
  I10: { kind: 'score', toPar: -1, tag: 'missed fairway, then birdie' },
};
