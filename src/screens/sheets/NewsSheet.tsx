import type { ComponentType, SVGProps } from 'react';
import { closeSheet } from '../../state/store';
import { Sheet } from '../../ui/components';
import { BoltIcon, FlameIcon, TrophyIcon, UsersIcon } from '../../ui/Icons';

/** The newest story on Home's News card. Add new ones at the top. */
export const NEWS = {
  tag: 'New',
  title: 'The Showdown update',
  text: 'Hands, the Crown and win chances',
};

const FEATURES: { icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; text: string }[] = [
  { icon: FlameIcon, title: 'Pick from a hand', text: 'Three cards before every hole, one from each level. You choose.' },
  { icon: BoltIcon, title: '40 cards', text: 'Name your own target, beat your own average, streaks, and cards about your friends.' },
  { icon: TrophyIcon, title: 'The Crown', text: "Beat the leader's score on a hole and take a stroke off." },
  { icon: TrophyIcon, title: 'Live win chances', text: 'After every hole, see everyone’s chance of winning.' },
  { icon: UsersIcon, title: 'Card packs', text: 'Switch packs on or off in Game options. Hard Mode is there if you want it.' },
];

export function NewsSheet() {
  return (
    <Sheet title="The Showdown update">
      <div className="news-list">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="news-item">
            <span className="news-item-icon" aria-hidden>
              <Icon width={22} height={22} />
            </span>
            <span className="news-item-text">
              <b>{title}</b>
              <small>{text}</small>
            </span>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-dark" onClick={closeSheet}>
        Let's play
      </button>
    </Sheet>
  );
}
