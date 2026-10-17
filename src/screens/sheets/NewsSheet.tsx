import type { ComponentType, SVGProps } from 'react';
import { closeSheet } from '../../state/store';
import { Sheet } from '../../ui/components';
import { BoltIcon, ClockIcon, FlagIcon, FlameIcon, ShareIcon, TrophyIcon, UsersIcon } from '../../ui/Icons';

/** The newest story on Home's News card. Add new ones at the top. */
export const NEWS = {
  tag: 'New',
  title: 'Version 1.0 is here',
  text: "See what's in it",
};

const FEATURES: { icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; text: string }[] = [
  { icon: FlameIcon, title: 'Pick your risk', text: 'Safe, Bold or Insane before every hole, with a new card each time.' },
  { icon: UsersIcon, title: 'Everyone on their own phone', text: 'Friends join with a code, link or QR code. No app needed.' },
  { icon: FlagIcon, title: 'Find your course', text: 'Search for it and every par fills itself in.' },
  { icon: BoltIcon, title: 'Twists', text: 'Mulligans, and the last 3 holes count double.' },
  { icon: TrophyIcon, title: 'Live standings', text: 'See who leads after every hole, and react to big moments.' },
  { icon: ShareIcon, title: 'Share the results', text: 'A results picture for the group chat when the round ends.' },
  { icon: ClockIcon, title: 'Past games', text: 'Every round is saved, and Play again starts with the same group.' },
];

export function NewsSheet() {
  return (
    <Sheet title="Version 1.0">
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
