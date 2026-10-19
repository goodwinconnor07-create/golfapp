// How the simulator judges each ruleset 2 card in src/game/cards.ts: app id → simulator id.
// Cards from deck v2 use the same id in both. A new card needs a line here (and a check in
// engine.ts or scripts/balance/checks.ts), or `npm run balance` stops and names it.
export const SIM_ID: Record<string, string> = {
  S17: 'B18', // Tidy Hole (the simulator's check is the same test)
  B21: 'P01', // Personal Par
  I23: 'P02', // Beat Your Average
  N01: 'N1', // Name Your Number
  N02: 'N2', // Name Your Green
  N03: 'N3', // Name Your Putts
  S18: 'S26', // Steady Eddie
  B25: 'S23', // Better Half
  I24: 'S20', // Personal Best
  I25: 'M01', // Three-Hole Streak
  I26: 'M02', // Hot Hand
  I27: 'T01', // Dance Floor
  I28: 'T02', // Up and Down
  B26: 'T03', // Three Good Shots
  I29: 'T04', // Go For It
  B27: 'T05', // Big Number Dodge
  B28: 'G01', // Shadow
  B29: 'G03', // Underdog
  S19: 'G04', // Bodyguard
  I30: 'F04', // Flag Length
  B30: 'K01', // Three-Club Hole
  I31: 'K02', // No Driver
  B31: 'K03', // Putter Off the Fringe
  I32: 'K04', // One Club
  I33: 'K05', // Tee It Forward
  B32: 'K06', // Short Bag
};
