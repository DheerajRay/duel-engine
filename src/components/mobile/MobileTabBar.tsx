import { BookOpen, Gamepad2, History, Layers3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type MobileTabId = 'play' | 'decks' | 'history' | 'help';

const TAB_META: Record<MobileTabId, { label: string; icon: LucideIcon }> = {
  play: { label: 'Play', icon: Gamepad2 },
  decks: { label: 'Decks', icon: Layers3 },
  history: { label: 'History', icon: History },
  help: { label: 'Help', icon: BookOpen },
};

export function MobileTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: MobileTabId;
  onTabChange: (tab: MobileTabId) => void;
}) {
  return (
    <div className="md:hidden z-20 grid shrink-0 grid-cols-4 border-t border-zinc-800 bg-black/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur">
      {(Object.keys(TAB_META) as MobileTabId[]).map((tab) => {
        const { label, icon: Icon } = TAB_META[tab];
        const isActive = activeTab === tab;

        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 transition-colors ${
              isActive ? 'bg-zinc-900 text-white' : 'text-zinc-500'
            }`}
          >
            <Icon size={16} />
            <span className="text-[9px] font-mono uppercase tracking-[0.22em]">
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
