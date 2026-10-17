import { cleanName, isNameBlocked } from '../game';
import { navigate, openSheet, setDraftNames, useApp } from '../state/store';
import { BackBar, HeroPicture } from '../ui/components';

/** Setup step 1: just the host's name. Everyone else joins from their own phone with the code. */
export function SetupPlayers() {
  const names = useApp((s) => s.draft.names);
  const name = names[0] ?? '';
  const blocked = isNameBlocked(name);
  const valid = Boolean(cleanName(name)) && !blocked;
  const look = useApp((s) => s.profileLook);
  const next = () => {
    // Anyone after the host came from "Play again" and stays on the list.
    setDraftNames([name, ...names.slice(1)]);
    navigate({ name: 'setupCourse' });
  };

  return (
    <div className="screen">
      <BackBar title="New game" />
      <div className="screen-body">
        <h1 className="h1">What's your name?</h1>
        <p className="muted" style={{ margin: 0 }}>
          Next you'll get a code. Your group joins on their own phones and picks their own cards.
        </p>
        <HeroPicture name={name} look={look} nameTag onChange={() => openSheet({ name: 'look', editName: true })} />
      </div>
      <div className="screen-foot">
        <button type="button" className="btn btn-xl btn-green" disabled={!valid} onClick={next}>
          Next
        </button>
      </div>
    </div>
  );
}
