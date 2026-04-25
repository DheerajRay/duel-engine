import { BookOpen, Gamepad2, History, Layers3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppPreferences } from '../../preferences/AppPreferencesProvider';

type MobileTabId = 'play' | 'decks' | 'history' | 'help';

const TAB_META: Record<MobileTabId, { labelKey: 'play' | 'decks' | 'history' | 'help'; icon: LucideIcon }> = {
  play: { labelKey: 'play', icon: Gamepad2 },
  decks: { labelKey: 'decks', icon: Layers3 },
  history: { labelKey: 'history', icon: History },
  help: { labelKey: 'help', icon: BookOpen },
};

export function MobileTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: MobileTabId;
  onTabChange: (tab: MobileTabId) => void;
}) {
  const { t } = useAppPreferences();

  return (
    <div className="theme-screen theme-divider md:hidden z-20 grid shrink-0 grid-cols-4 border-t px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur">
      {(Object.keys(TAB_META) as MobileTabId[]).map((tab) => {
        const { labelKey, icon: Icon } = TAB_META[tab];
        const isActive = activeTab === tab;

        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 transition-colors ${
              isActive ? 'theme-chip-active' : 'theme-subtle'
            }`}
          >
            <Icon size={16} />
            <span className="text-[9px] font-mono uppercase tracking-[0.22em]">
              {t(labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
