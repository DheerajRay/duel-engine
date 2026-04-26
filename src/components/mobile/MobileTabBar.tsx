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
    <div className="ui-tab-bar theme-screen theme-divider md:hidden z-20 grid shrink-0 grid-cols-4 border-t px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-1 backdrop-blur">
      {(Object.keys(TAB_META) as MobileTabId[]).map((tab) => {
        const { labelKey, icon: Icon } = TAB_META[tab];
        const isActive = activeTab === tab;

        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`flex flex-col items-center justify-center gap-0 rounded-[8px] px-1 py-1 transition-colors ${
              isActive ? 'theme-chip-active' : 'theme-subtle'
            }`}
          >
            <Icon size={12} />
            <span className="ui-mono-label text-[8px] tracking-[0.1em]">
              {t(labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
