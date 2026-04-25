import type { ReactNode } from 'react';

export function MobileAppBar({
  title,
  rightSlot,
}: {
  title: string;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="md:hidden z-20 flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 bg-black/95 px-4 backdrop-blur">
      <div className="text-[11px] font-mono uppercase tracking-[0.34em] text-zinc-400">
        {title}
      </div>
      {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
    </div>
  );
}
