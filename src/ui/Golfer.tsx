import { pose, rig, swingTracks, type PartName, type Swing, type View } from './golferPose';

// Illustration colours are part of the drawing, not UI tokens.
const SHIRT = '#2f6fe4';
const SLEEVE = '#2a62cc';
const TROUSERS = '#2a3142';
const SKIN = '#eab38c';
const SKIN_FAR = '#d29a74';
const WHITE = '#ffffff';
const BRIM = '#e6eaf0';
const SHAFT = '#dfe3e9';
const IRON = '#3a404c';
const GRIP = '#1c1f26';

/** How each part is drawn: stroked lines with round ends, in the golfer's units (about 40 tall). */
const LOOK: Record<PartName, { stroke?: string; width?: number; fill?: string }> = {
  farLeg: { stroke: TROUSERS, width: 3.5 },
  nearLeg: { stroke: TROUSERS, width: 3.7 },
  farShoe: { stroke: WHITE, width: 2.2 },
  nearShoe: { stroke: WHITE, width: 2.3 },
  seat: { stroke: TROUSERS, width: 5.6 },
  torso: { stroke: SHIRT, width: 6.4, fill: SHIRT },
  farArm: { stroke: SKIN_FAR, width: 1.9 },
  farSleeve: { stroke: SLEEVE, width: 2.7 },
  shaft: { stroke: SHAFT, width: 0.75 },
  clubHead: { stroke: IRON, width: 1.5 },
  grip: { stroke: GRIP, width: 1.1 },
  nearArm: { stroke: SKIN, width: 2 },
  nearSleeve: { stroke: SHIRT, width: 2.8 },
  head: { fill: SKIN },
  cap: { fill: WHITE },
  brim: { stroke: BRIM, width: 1.2 },
};

/**
 * A small golfer who plays the shot. He stands at address, swings from `begin`, strikes the ball
 * impactAt(swing) seconds later and holds his finish. The still shows the finish.
 *
 * x, y: the ground under the ball. ballY: how far the ball's centre is above that, in px.
 * scale: his size (1 is about 40 px tall), matched to the ball's place in the scene.
 * face: seen face-on with the target to the right. side: from behind, facing right.
 */
export function Golfer({
  x,
  y,
  scale,
  ballY,
  view,
  swing,
  begin,
  still,
  driver,
}: {
  x: number;
  y: number;
  scale: number;
  ballY: number;
  view: View;
  swing: Swing;
  begin: string;
  still: boolean;
  driver?: boolean;
}) {
  const r = rig(view, -ballY / scale, driver);
  const rest = pose(r, swing, still ? 'finish' : 'address');
  const tracks = still ? null : swingTracks(r, swing);
  const dur = tracks ? `${tracks.duration.toFixed(3)}s` : '';
  const headWidth = driver ? 2.4 : 1.5;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {/* A soft shadow under his feet. */}
      <ellipse
        cx={view === 'face' ? 0 : -17.5}
        cy={view === 'face' ? -4 : 0.2}
        rx={view === 'face' ? 10.5 : 8.5}
        ry="2"
        fill="#0d3a15"
        opacity="0.28"
      />
      {(Object.keys(LOOK) as PartName[]).map((part) => {
        const look = LOOK[part];
        return (
          <path
            key={part}
            d={rest[part]}
            fill={look.fill ?? 'none'}
            stroke={look.stroke}
            strokeWidth={part === 'clubHead' ? headWidth : part === 'torso' && view === 'face' ? 2 : look.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {tracks && <animate attributeName="d" values={tracks.values[part]} begin={begin} dur={dur} fill="freeze" />}
          </path>
        );
      })}
    </g>
  );
}
