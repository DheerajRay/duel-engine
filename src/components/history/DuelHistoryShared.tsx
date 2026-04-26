import type { DuelHistoryEntry } from '../../types/cloud';
import { formatLogEntryMessage } from '../../utils/logFormatter';
import { useAppPreferences } from '../../preferences/AppPreferencesProvider';

const getHistoryModeLabel = (
  mode: DuelHistoryEntry['mode'],
  t: ReturnType<typeof useAppPreferences>['t'],
) => {
  if (mode === 'cpu_random') return t('cpuRandom');
  if (mode === 'cpu_custom') return t('cpuCustom');
  return t('competitionMode');
};

const getHistoryResultLabel = (
  result: DuelHistoryEntry['result'],
  t: ReturnType<typeof useAppPreferences>['t'],
) => {
  if (result === 'win') return t('wins');
  if (result === 'loss') return t('losses');
  return t('forfeits');
};

export const getHistoryResultMarker = (result: DuelHistoryEntry['result']) => {
  if (result === 'win') return 'W';
  if (result === 'loss') return 'L';
  return 'F';
};

export function DuelHistoryEntryCard({
  entry,
  onClick,
  compact = false,
}: {
  entry: DuelHistoryEntry;
  onClick?: () => void;
  compact?: boolean;
}) {
  const { t } = useAppPreferences();
  const modeLabel = getHistoryModeLabel(entry.mode, t);
  const resultLabel = getHistoryResultLabel(entry.result, t);
  const resultMarker = getHistoryResultMarker(entry.result);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`theme-panel w-full text-left transition-colors hover:border-[var(--app-border-strong)] ${
        compact ? 'rounded-[10px] px-3 py-2.5' : 'rounded-[12px] px-3 py-3'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="theme-eyebrow text-[8px]">{modeLabel}</div>
          <div className={`theme-title mt-1 uppercase tracking-[0.06em] text-[var(--app-text-primary)] ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
            {entry.opponentLabel}
          </div>
          <div className={`theme-muted mt-1 ${compact ? 'text-[9px] leading-4' : 'text-[10px] leading-4.5'}`}>
            {entry.summary}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="theme-eyebrow text-[7px]">{resultLabel}</div>
          <div className="mt-1 flex h-6 w-6 items-center justify-center border border-[var(--app-border-strong)] text-[10px] font-mono uppercase text-[var(--app-text-primary)]">
            {resultMarker}
          </div>
        </div>
      </div>
    </button>
  );
}

export function DuelHistoryDetailContent({
  entry,
  compact = false,
}: {
  entry: DuelHistoryEntry;
  compact?: boolean;
}) {
  const { t, language } = useAppPreferences();

  return (
    <div className="space-y-3">
      <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'md:grid-cols-4'}`}>
        <div className="theme-elevated px-3 py-2.5">
          <div className="theme-eyebrow text-[8px]">{t('turns')}</div>
          <div className="mt-1 text-[11px] font-mono text-[var(--app-text-primary)]">{entry.turnCount}</div>
        </div>
        <div className="theme-elevated px-3 py-2.5">
          <div className="theme-eyebrow text-[8px]">{t('lp')}</div>
          <div className="mt-1 text-[11px] font-mono text-[var(--app-text-primary)]">{entry.lpRemaining}</div>
        </div>
        <div className="theme-elevated px-3 py-2.5">
          <div className="theme-eyebrow text-[8px]">{t('finish')}</div>
          <div className="mt-1 text-[11px] font-mono text-[var(--app-text-primary)]">{entry.finishingCard ?? 'N/A'}</div>
        </div>
        <div className="theme-elevated px-3 py-2.5">
          <div className="theme-eyebrow text-[8px]">{t('date')}</div>
          <div className="mt-1 text-[11px] font-mono text-[var(--app-text-primary)]">
            {new Date(entry.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="theme-panel rounded-[10px] px-3 py-3">
        <div className="theme-eyebrow text-[8px]">{t('notablePlay')}</div>
        <div className={`mt-1.5 text-[var(--app-text-secondary)] ${compact ? 'text-[10px] leading-4.5' : 'text-sm leading-6'}`}>
          {entry.notablePlay}
        </div>
      </div>

      <div className="theme-panel rounded-[10px]">
        <div className="theme-divider theme-eyebrow border-b px-3 py-2 text-[8px]">
          {t('duelLog')}
        </div>
        <div className={compact ? 'max-h-48 overflow-y-auto' : 'max-h-64 overflow-y-auto'}>
          {entry.logs.map((log) => (
            <div
              key={log.id}
              className={`theme-divider border-b px-3 py-2 text-[var(--app-text-secondary)] last:border-b-0 ${
                compact ? 'text-[9px] leading-4.5' : 'text-xs leading-5'
              }`}
            >
              {formatLogEntryMessage(log, language)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
