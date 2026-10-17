import { cleanName, isNameBlocked } from '../game';
import { navigate, openSheet, setDraftNames, useApp } from '../state/store';
import { BackBar, NameAndPicture } from '../ui/components';

/** Setup step 1: just the host's name. Everyone else joins from their own phone with the code. */
export function SetupPlayers() {
  const names = useApp((s) => s.draft.names);
  const name = names[0] ?? '';
  const valid = Boolean(cleanName(name)) && !isNameBlocked(name);
  const look = useApp((s) => s.profileLook);
  // Anyone after the host came from "Play again" and stays on the list.
  const setName = (value: string) => setDraftNames([value, ...names.slice(1)]);
  const next = () => {
    if (valid) navigate({ name: 'setupCourse' });
  };

  return (
    <div className="screen">
      <BackBar title="New game" />
      <div className="screen-body">
        <h1 className="h1">What's your name?</h1>
        <p className="muted" style={{ margin: 0 }}>
          Friends join on their own phones with a code.
        </p>
        <NameAndPicture name={name} look={look} onName={setName} onPicture={() => openSheet({ name: 'look' })} onDone={next} />
      </div>
      <div className="screen-foot">
        <button type="button" className="btn btn-xl btn-green" disabled={!valid} onClick={next}>
          Next
        </button>
      </div>
    </div>
  );
}
