import { useApp } from './state/store';
import { Blobs, Toasts } from './ui/components';
import { Home } from './screens/Home';
import { HowToPlay } from './screens/HowToPlay';
import { SetupPlayers } from './screens/SetupPlayers';
import { SetupCourse } from './screens/SetupCourse';
import { Join, JoinWho } from './screens/Join';
import { GameScreen } from './screens/game/GameScreen';
import { Scorecard } from './screens/Scorecard';
import { History } from './screens/History';
import { SheetHost } from './screens/sheets/SheetHost';
import { ScoreFlash } from './screens/game/ScoreFlash';

export function App() {
  const route = useApp((s) => s.stack[s.stack.length - 1]);
  const depth = useApp((s) => s.stack.length);
  const sheet = useApp((s) => s.sheet);
  const sheetKey = useApp((s) => s.sheetKey);
  const flash = useApp((s) => s.flash);

  let screen;
  switch (route.name) {
    case 'home':
      screen = <Home />;
      break;
    case 'howto':
      screen = <HowToPlay intro={route.intro} />;
      break;
    case 'setupPlayers':
      screen = <SetupPlayers />;
      break;
    case 'setupCourse':
      screen = <SetupCourse />;
      break;
    case 'join':
      screen = <Join initialCode={route.code} />;
      break;
    case 'joinWho':
      screen = <JoinWho info={route.info} />;
      break;
    case 'game':
      screen = <GameScreen />;
      break;
    case 'scorecard':
      screen = <Scorecard />;
      break;
    case 'history':
      screen = <History />;
      break;
  }

  return (
    <>
      {/* The level colours drifting behind every screen. */}
      <Blobs />
      <div key={`${depth}-${route.name}`}>{screen}</div>
      {sheet && <SheetHost key={sheetKey} sheet={sheet} />}
      {flash && <ScoreFlash key={flash.key} flash={flash} />}
      <Toasts />
    </>
  );
}
