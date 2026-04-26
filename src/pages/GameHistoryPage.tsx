import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { MobileBottomSheet } from '../components/mobile/MobileBottomSheet';
import { useIsMobile } from '../hooks/useIsMobile';
import { getDuelHistory } from '../services/history';
import type { DuelHistoryEntry } from '../types/cloud';
import { useAppPreferences } from '../preferences/AppPreferencesProvider';
import { formatLogEntryMessage } from '../utils/logFormatter';

type HistoryFilter = {
  mode: 'all' | DuelHistoryEntry['mode'];
  result: 'all' | DuelHistoryEntry['result'];
  opponent: string;
};

const MODE_OPTIONS: HistoryFilter['mode'][] = ['all', 'cpu_random', 'cpu_custom', 'competition'];
const RESULT_OPTIONS: HistoryFilter['result'][] = ['all', 'win', 'loss', 'forfeit'];

export default function GameHistoryPage({
  onBack,
  embeddedInShell = false,
}: {
  onBack: () => void;
  embeddedInShell?: boolean;
}) {
  const { t, language } = useAppPreferences();
  const isMobile = useIsMobile();
  const mobileLayout = embeddedInShell && isMobile;
  const [history, setHistory] = useState<DuelHistoryEntry[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>({ mode: 'all', result: 'all', opponent: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  useEffect(() => {
    void getDuelHistory().then(setHistory);
  }, []);

  const filteredHistory = useMemo(() => {
    return history.filter((entry) => {
      if (filter.mode !== 'all' && entry.mode !== filter.mode) return false;
      if (filter.result !== 'all' && entry.result !== filter.result) return false;
      if (filter.opponent && !entry.opponentLabel.toLowerCase().includes(filter.opponent.toLowerCase())) return false;
      return true;
    });
  }, [history, filter]);

  const expandedEntry = filteredHistory.find((entry) => entry.id === expandedId) ?? null;

  const renderExpandedContent = (entry: DuelHistoryEntry) => (
    <div className="space-y-4">
      <div className={`grid gap-3 ${mobileLayout ? 'grid-cols-2' : 'md:grid-cols-4'}`}>
        <div className="border border-zinc-800 bg-black px-3 py-3">
          <div className="theme-eyebrow text-[9px]">{t('turns')}</div>
          <div className="mt-2 text-sm font-mono text-white">{entry.turnCount}</div>
        </div>
        <div className="border border-zinc-800 bg-black px-3 py-3">
          <div className="theme-eyebrow text-[9px]">{t('lp')}</div>
          <div className="mt-2 text-sm font-mono text-white">{entry.lpRemaining}</div>
        </div>
        <div className="border border-zinc-800 bg-black px-3 py-3">
          <div className="theme-eyebrow text-[9px]">{t('finish')}</div>
          <div className="mt-2 text-sm font-mono text-white">{entry.finishingCard ?? 'N/A'}</div>
        </div>
        <div className="border border-zinc-800 bg-black px-3 py-3">
          <div className="theme-eyebrow text-[9px]">{t('date')}</div>
          <div className="mt-2 text-sm font-mono text-white">
            {new Date(entry.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-black px-4 py-4">
        <div className="theme-eyebrow text-[10px]">{t('notablePlay')}</div>
        <div className="mt-2 text-sm leading-6 text-zinc-300">{entry.notablePlay}</div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-black">
        <div className="theme-divider theme-eyebrow border-b px-4 py-3 text-[10px]">
          {t('duelLog')}
        </div>
        <div className="max-h-64 overflow-y-auto">
          {entry.logs.map((log) => (
            <div key={log.id} className="border-b border-zinc-900 px-4 py-3 text-xs leading-5 text-zinc-300 last:border-b-0">
              {formatLogEntryMessage(log, language)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const rootClasses = mobileLayout
    ? 'flex h-full min-h-0 flex-col bg-black text-white'
    : 'h-dvh md:h-screen box-border overflow-hidden bg-black text-white font-sans flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:p-0';

  return (
    <div className={`${rootClasses} theme-screen`}>
      {!mobileLayout && (
        <div className="theme-screen theme-divider h-14 md:h-12 border-b flex items-center justify-between px-3 md:px-6 shrink-0">
          <button
            onClick={onBack}
            className="theme-subtle hover:text-[var(--app-text-primary)] transition-colors flex items-center gap-2 font-mono text-xs uppercase tracking-widest"
          >
            <ArrowLeft size={14} /> {t('back')}
          </button>
          <h1 className="theme-eyebrow text-xs">{t('gameHistory')}</h1>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${mobileLayout ? 'px-3 py-3' : 'px-4 md:px-8 py-6'} flex flex-col gap-5`}>
        {mobileLayout ? (
          <div className="space-y-3">
            <div>
              <div className="theme-eyebrow text-[9px]">{t('mode')}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {MODE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFilter((previous) => ({ ...previous, mode: option }))}
                    className={`shrink-0 rounded-[8px] border px-2 py-1 text-[6px] font-mono uppercase tracking-[0.08em] ${
                      filter.mode === option ? 'theme-chip-active' : 'theme-chip'
                    }`}
                  >
                    {option === 'all'
                      ? t('all')
                      : option === 'cpu_random'
                        ? t('cpuRandom')
                        : option === 'cpu_custom'
                          ? t('cpuCustom')
                          : t('competitionMode')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="theme-eyebrow text-[9px]">{t('result')}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {RESULT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFilter((previous) => ({ ...previous, result: option }))}
                    className={`shrink-0 rounded-[8px] border px-2 py-1 text-[6px] font-mono uppercase tracking-[0.08em] ${
                      filter.result === option ? 'theme-chip-active' : 'theme-chip'
                    }`}
                  >
                    {option === 'all' ? t('all') : option === 'win' ? t('wins') : option === 'loss' ? t('losses') : t('forfeit')}
                  </button>
                ))}
              </div>
            </div>

            <input
              value={filter.opponent}
              onChange={(event) => setFilter((previous) => ({ ...previous, opponent: event.target.value }))}
              placeholder={t('searchOpponent')}
              className="theme-input w-full rounded-[8px] px-3 py-1.5 text-[8px] font-mono uppercase tracking-[0.08em]"
            />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={filter.mode}
              onChange={(event) => setFilter((previous) => ({ ...previous, mode: event.target.value as HistoryFilter['mode'] }))}
              className="theme-input rounded-none px-4 py-3 text-xs font-mono uppercase tracking-widest"
            >
              <option value="all">{t('mode')} - {t('resultsAll')}</option>
              <option value="cpu_random">{t('cpuRandom')}</option>
              <option value="cpu_custom">{t('cpuCustom')}</option>
              <option value="competition">{t('competitionMode')}</option>
            </select>
            <select
              value={filter.result}
              onChange={(event) => setFilter((previous) => ({ ...previous, result: event.target.value as HistoryFilter['result'] }))}
              className="theme-input rounded-none px-4 py-3 text-xs font-mono uppercase tracking-widest"
            >
              <option value="all">{t('resultsAll')}</option>
              <option value="win">{t('wins')}</option>
              <option value="loss">{t('losses')}</option>
              <option value="forfeit">{t('forfeits')}</option>
            </select>
            <input
              value={filter.opponent}
              onChange={(event) => setFilter((previous) => ({ ...previous, opponent: event.target.value }))}
              placeholder={t('filterByOpponent')}
              className="theme-input rounded-none px-4 py-3 text-xs font-mono uppercase tracking-widest"
            />
          </div>
        )}

        {filteredHistory.length === 0 ? (
          <div className="theme-subtle flex-1 flex items-center justify-center text-xs font-mono uppercase tracking-widest text-center">
            {t('noDuelHistoryYet')}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredHistory.map((entry) => {
              const expanded = expandedId === entry.id;
              const modeLabel = entry.mode.replace('_', ' ');

              if (mobileLayout) {
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      setExpandedId(entry.id);
                      setSheetExpanded(false);
                    }}
                    className="rounded-[12px] border border-zinc-800 bg-zinc-950 px-3 py-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                        {modeLabel} | {entry.result}
                      </div>
                      <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-600">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="mt-2.5 text-[15px] font-mono uppercase tracking-[0.08em] text-white">
                      {entry.opponentLabel}
                    </div>
                    <div className="mt-2 text-[13px] leading-6 text-zinc-400">{entry.summary}</div>
                  </button>
                );
              }

              return (
                <div key={entry.id} className="border border-zinc-800 bg-zinc-950">
                  <button
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                    className="w-full px-4 py-4 flex items-center justify-between gap-4 text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono uppercase tracking-[0.26em] text-zinc-500">
                        {modeLabel} | {entry.result}
                      </div>
                      <div className="mt-2 text-base font-mono uppercase tracking-[0.12em] text-white truncate">
                        {entry.opponentLabel}
                      </div>
                      <div className="mt-2 text-xs text-zinc-400 leading-5">{entry.summary}</div>
                    </div>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {expanded && (
                    <div className="border-t border-zinc-800 px-4 py-4">
                      {renderExpandedContent(entry)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {mobileLayout && expandedEntry ? (
        <MobileBottomSheet
          open={Boolean(expandedEntry)}
          onClose={() => setExpandedId(null)}
                      title={t('duelSummary')}
          expandable
          expanded={sheetExpanded}
          onToggleExpanded={() => setSheetExpanded((previous) => !previous)}
          compactHeightClassName="max-h-[58vh]"
          maxHeightClassName="max-h-[84vh]"
        >
          <div className="space-y-4 pb-2">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">
                {expandedEntry.mode.replace('_', ' ')} | {expandedEntry.result}
              </div>
              <div className="mt-3 text-xl font-mono uppercase tracking-[0.14em] text-white">
                {expandedEntry.opponentLabel}
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-400">{expandedEntry.summary}</div>
            </div>
            {renderExpandedContent(expandedEntry)}
          </div>
        </MobileBottomSheet>
      ) : null}
    </div>
  );
}
