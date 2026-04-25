import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { MobileBottomSheet } from '../components/mobile/MobileBottomSheet';
import { useIsMobile } from '../hooks/useIsMobile';
import { getDuelHistory } from '../services/history';
import type { DuelHistoryEntry } from '../types/cloud';

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
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">Turns</div>
          <div className="mt-2 text-sm font-mono text-white">{entry.turnCount}</div>
        </div>
        <div className="border border-zinc-800 bg-black px-3 py-3">
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">LP</div>
          <div className="mt-2 text-sm font-mono text-white">{entry.lpRemaining}</div>
        </div>
        <div className="border border-zinc-800 bg-black px-3 py-3">
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">Finish</div>
          <div className="mt-2 text-sm font-mono text-white">{entry.finishingCard ?? 'N/A'}</div>
        </div>
        <div className="border border-zinc-800 bg-black px-3 py-3">
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">Date</div>
          <div className="mt-2 text-sm font-mono text-white">
            {new Date(entry.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-black px-4 py-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">Notable Play</div>
        <div className="mt-2 text-sm leading-6 text-zinc-300">{entry.notablePlay}</div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-black">
        <div className="border-b border-zinc-800 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">
          Duel Log
        </div>
        <div className="max-h-64 overflow-y-auto">
          {entry.logs.map((log) => (
            <div key={log.id} className="border-b border-zinc-900 px-4 py-3 text-xs leading-5 text-zinc-300 last:border-b-0">
              {log.message}
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
    <div className={rootClasses}>
      {!mobileLayout && (
        <div className="h-14 md:h-12 border-b border-zinc-800 flex items-center justify-between px-3 md:px-6 bg-black shrink-0">
          <button
            onClick={onBack}
            className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 font-mono text-xs uppercase tracking-widest"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Game History</h1>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${mobileLayout ? 'px-4 py-4' : 'px-4 md:px-8 py-6'} flex flex-col gap-5`}>
        {mobileLayout ? (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">Mode</div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {MODE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFilter((previous) => ({ ...previous, mode: option }))}
                    className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-mono uppercase tracking-[0.22em] ${
                      filter.mode === option ? 'border-white bg-white text-black' : 'border-zinc-800 text-zinc-500'
                    }`}
                  >
                    {option === 'all' ? 'All' : option.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">Result</div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {RESULT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFilter((previous) => ({ ...previous, result: option }))}
                    className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-mono uppercase tracking-[0.22em] ${
                      filter.result === option ? 'border-white bg-white text-black' : 'border-zinc-800 text-zinc-500'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <input
              value={filter.opponent}
              onChange={(event) => setFilter((previous) => ({ ...previous, opponent: event.target.value }))}
              placeholder="Search opponent"
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs font-mono uppercase tracking-[0.18em] text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={filter.mode}
              onChange={(event) => setFilter((previous) => ({ ...previous, mode: event.target.value as HistoryFilter['mode'] }))}
              className="bg-zinc-950 border border-zinc-800 rounded-none px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-zinc-500 uppercase tracking-widest"
            >
              <option value="all">All Modes</option>
              <option value="cpu_random">CPU Random</option>
              <option value="cpu_custom">CPU Custom</option>
              <option value="competition">Competition</option>
            </select>
            <select
              value={filter.result}
              onChange={(event) => setFilter((previous) => ({ ...previous, result: event.target.value as HistoryFilter['result'] }))}
              className="bg-zinc-950 border border-zinc-800 rounded-none px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-zinc-500 uppercase tracking-widest"
            >
              <option value="all">All Results</option>
              <option value="win">Wins</option>
              <option value="loss">Losses</option>
              <option value="forfeit">Forfeits</option>
            </select>
            <input
              value={filter.opponent}
              onChange={(event) => setFilter((previous) => ({ ...previous, opponent: event.target.value }))}
              placeholder="Filter by opponent"
              className="bg-zinc-950 border border-zinc-800 rounded-none px-4 py-3 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 uppercase tracking-widest"
            />
          </div>
        )}

        {filteredHistory.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs font-mono uppercase tracking-widest text-center">
            No duel history yet.
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
                    className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[10px] font-mono uppercase tracking-[0.26em] text-zinc-500">
                        {modeLabel} | {entry.result}
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="mt-3 text-base font-mono uppercase tracking-[0.12em] text-white">
                      {entry.opponentLabel}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-zinc-400">{entry.summary}</div>
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
          title="Duel Summary"
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
