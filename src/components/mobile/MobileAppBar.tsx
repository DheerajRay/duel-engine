import type { ReactNode } from 'react';

export function MobileAppBar({
  title,
  rightSlot,
}: {
  title: string;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="theme-screen theme-divider md:hidden z-20 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur">
      <div className="theme-eyebrow text-[11px]">
        {title}
      </div>
      {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
    </div>
  );
}
