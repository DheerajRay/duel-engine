import type { ReactNode } from 'react';

export function MobileAppBar({
  title,
  rightSlot,
}: {
  title: string;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="ui-app-bar theme-screen theme-divider md:hidden z-20 flex shrink-0 items-center justify-between border-b px-3 backdrop-blur">
      <div className="ui-eyebrow">
        {title}
      </div>
      {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
    </div>
  );
}
