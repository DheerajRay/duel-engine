import React, { Suspense, lazy, useReducer, useEffect, useState, useRef } from 'react';
import { gameReducer, initialState, type Action } from './engine/reducer';
import { AnnouncementOverlay } from './components/AnnouncementOverlay';
import { CardView } from './components/CardView';
import { MobileAppBar } from './components/mobile/MobileAppBar';
import { MobileBottomSheet } from './components/mobile/MobileBottomSheet';
import { MobileTabBar, type MobileTabId } from './components/mobile/MobileTabBar';
import { DuelHistoryDetailContent, DuelHistoryEntryCard } from './components/history/DuelHistoryShared';
import { useIsMobile } from './hooks/useIsMobile';
import { AnnouncementInput, useAnnouncementQueue } from './hooks/useAnnouncementQueue';
import { GameCard, LogEntry, Phase } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Layers3, Settings, Shield, Swords, Trophy, UserRound } from 'lucide-react';
import { generateCuratedDeck, generateCuratedExtraDeck } from './utils/deckGenerator';
import { COMPETITION_LADDER, formatCompetitionLogMessage, getCompetitionNotablePlay } from './utils/competitionMode';
import {
  buildCompetitionPreviewCard,
  canActivateCard,
  canActivateSetCard,
  getCardSupportMeta,
  getCompetitionAiScore,
  getHandCardActionAvailability,
  getPossibleFusionMonsters,
  getResponseWindowOptions,
  isMaterialMatch,
} from './effects/registry';
import { getSharedTransition, useMotionPreference } from './utils/motion';
import { ensureProfile, getCurrentUser, onAuthStateChange, signOut, toUserProfile } from './services/auth';
import { initializeGameContent } from './services/gameContent';
import { appendDuelHistoryEntry, getDuelHistory } from './services/history';
import {
  clearCompetitionProgress,
  ensureStarterCustomDeck,
  getCompetitionProgress,
  getPrimaryDeckSnapshot,
  getUserDeckState,
  setCompetitionProgress,
} from './services/userData';
import type { DuelHistoryEntry, UserProfile } from './types/cloud';
import { useAppPreferences } from './preferences/AppPreferencesProvider';
import { getLocalizedCompetitionContent } from './i18n/competitionContent';
import { formatLogEntryMessage } from './utils/logFormatter';
import {
  getCardSubtypeTranslationKey,
  getCardTypeTranslationKey,
  getLocalizedCardText,
  getLocalizedSupportStatusKey,
} from './services/cardLocalization';

const DeckBuilder = lazy(() => import('./pages/DeckBuilder'));
const HowToPlay = lazy(() => import('./pages/HowToPlay'));
const SignInPage = lazy(() => import('./pages/SignInPage'));
const GameHistoryPage = lazy(() => import('./pages/GameHistoryPage'));

const BOOT_TIMEOUT_MS = 900;
const AUTH_GATE_TIMEOUT_MS = 5000;

const withTimeout = <T,>(promise: PromiseLike<T>, fallback: T, timeoutMs = BOOT_TIMEOUT_MS): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve(fallback);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }) as Promise<T>;
};

type UIState = 
  | { type: 'IDLE' }
  | { type: 'SELECT_HAND_CARD', card: GameCard }
  | { type: 'SELECT_TRIBUTES', cardToSummon: GameCard, count: number, selected: number[], position: 'attack' | 'set-monster' }
  | { type: 'SELECT_ATTACK_TARGET', attackerIndex: number }
  | { type: 'SELECT_DISCARD', spellCard: GameCard, fromZone?: number }
  | { type: 'SELECT_SPELL_TARGET', spellCard: GameCard, discardInstanceId?: string, fromZone?: number }
  | { type: 'SELECT_FUSION_MONSTER', possibleFusions: GameCard[], spellInstanceId: string, fromZone?: number }
  | { type: 'SELECT_FUSION_MATERIALS', fusionMonster: GameCard, spellInstanceId: string, fromZone?: number, selectedMaterials: string[] }
  | {
      type: 'SELECT_ZONE_CARD',
      title: string,
      description: string,
      zone: 'graveyard' | 'deck',
      owner: 'player' | 'opponent',
      cards: { card: GameCard, sourceIndex: number }[],
      purpose: {
        type: 'MONSTER_REBORN',
        spellCard: GameCard,
        fromZone?: number,
        targetPlayer: 'player' | 'opponent',
      },
    }
  | {
      type: 'CONFIRM_RESPONSE',
      message: string,
      options: {
        card: GameCard,
        fromZone: number,
        title: string,
        description: string,
      }[],
      pendingAction:
        | { type: 'SUMMON_MONSTER', player: 'opponent', cardInstanceId: string, position: 'attack' | 'set-monster', tributes: number[], responseOverrides?: Record<string, boolean> }
        | { type: 'FUSION_SUMMON', player: 'opponent', fusionMonsterId: string, materialInstanceIds: string[], spellInstanceId: string, fromZone?: number, responseOverrides?: Record<string, boolean> }
        | { type: 'DECLARE_ATTACK', attackerIndex: number, targetIndex: number | null, responseOverrides?: Record<string, boolean> },
    };

export default function App() {
  const { t, hydrateProfile, language, theme, setLanguage, setTheme, languageOptions, themeOptions } = useAppPreferences();
  const [view, setView] = useState<'start' | 'game' | 'deck-builder' | 'how-to-play' | 'sign-in' | 'history'>('start');
  const [mobileTab, setMobileTab] = useState<MobileTabId>('play');
  const [gameMode, setGameMode] = useState<'random' | 'custom' | 'competition' | null>(null);
  const [competitionStageIndex, setCompetitionStageIndex] = useState<number | null>(null);
  const [competitionResumeStageIndex, setCompetitionResumeStageIndex] = useState(0);
  const [pendingCpuModeSelection, setPendingCpuModeSelection] = useState(false);
  const [showMenuConfirm, setShowMenuConfirm] = useState(false);
  const [showCompetitionLobby, setShowCompetitionLobby] = useState(false);
  const [showCompetitionIntro, setShowCompetitionIntro] = useState(false);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [authPromptDismissed, setAuthPromptDismissed] = useState(false);
  const [bootState, setBootState] = useState<'ready' | 'error'>('ready');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showMobileAccountSheet, setShowMobileAccountSheet] = useState(false);
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const [primaryDeckSummary, setPrimaryDeckSummary] = useState<{ name: string; mainCount: number; extraCount: number; valid: boolean } | null>(null);
  const [duelRecordSummary, setDuelRecordSummary] = useState({ wins: 0, losses: 0, forfeits: 0 });
  const [duelHistoryEntries, setDuelHistoryEntries] = useState<DuelHistoryEntry[]>([]);
  const [mobileHistoryExpanded, setMobileHistoryExpanded] = useState(false);
  const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState<string | null>(null);
  const [mobileHistorySheetExpanded, setMobileHistorySheetExpanded] = useState(false);
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [uiState, setUiState] = useState<UIState>({ type: 'IDLE' });
  const [showCardDetail, setShowCardDetail] = useState<GameCard | null>(null);
  const [mobileInfoTab, setMobileInfoTab] = useState<'details' | 'log'>('details');
  const [mobileInfoExpanded, setMobileInfoExpanded] = useState(false);
  const [aiResumeTick, setAiResumeTick] = useState(0);
  const authBootstrapResolvedRef = useRef(false);
  const prevLogLengthRef = useRef(state.log.length);
  const prevPlayerPhaseKeyRef = useRef<string | null>(null);
  const duelHistorySavedRef = useRef<string | null>(null);
  const mobileBattlefieldRef = useRef<HTMLDivElement | null>(null);
  const currentCompetitionOpponent = competitionStageIndex !== null ? COMPETITION_LADDER[competitionStageIndex] : null;
  const competitionResumeOpponent = COMPETITION_LADDER[competitionResumeStageIndex];
  const competitionSignatureCards = currentCompetitionOpponent?.signatureCardIds.map(buildCompetitionPreviewCard) ?? [];
  const localizedCompetitionContent = currentCompetitionOpponent
    ? getLocalizedCompetitionContent(language, currentCompetitionOpponent.id, currentCompetitionOpponent)
    : null;
  const opponentLabel = localizedCompetitionContent?.name ?? currentCompetitionOpponent?.name ?? 'COM';
  const opponentShortLabel = opponentLabel.split(' ')[0] ?? 'Opponent';
  const cpuModeHeading =
    gameMode === 'random'
      ? t('cpuModeRandomDeck')
      : gameMode === 'custom'
        ? t('cpuModeCustomDeck')
        : pendingCpuModeSelection
          ? t('cpuMode')
          : null;
  const canPlayerDraw = state.turn === 'player' && state.phase === 'DP';
  const isMobile = useIsMobile();
  const hasActiveDuel = view === 'game' && !pendingCpuModeSelection && gameMode !== null && !state.winner;
  const showAuthPrompt = view === 'start' && authCheckComplete && !userProfile && !authPromptDismissed;
  const { reduced } = useMotionPreference();
  const { activeAnnouncement, announce, clearAnnouncements } = useAnnouncementQueue(990);
  const selectedHistoryEntry = duelHistoryEntries.find((entry) => entry.id === selectedHistoryEntryId) ?? null;
  const playerActivationContext = {
    player: state.player,
    opponent: state.opponent,
    normalSummonUsed: state.normalSummonUsed,
    phase: state.phase,
  };

  const showAnnouncement = (input: AnnouncementInput) => announce(input);
  const showNotice = (message: string, title = t('notice')) => announce({ title, message });

  const cyclePreferenceOption = <T extends string>(
    options: Array<{ value: T }>,
    currentValue: T,
    direction: 'previous' | 'next',
  ) => {
    const currentIndex = options.findIndex((option) => option.value === currentValue);
    if (currentIndex === -1 || options.length === 0) return currentValue;
    const nextIndex =
      direction === 'next'
        ? (currentIndex + 1) % options.length
        : (currentIndex - 1 + options.length) % options.length;
    return options[nextIndex]?.value ?? currentValue;
  };

  const refreshDuelRecordSummary = async () => {
    const historyEntries = await withTimeout(getDuelHistory(), [] as DuelHistoryEntry[]);
    const summary = historyEntries.reduce(
      (acc, entry) => {
        if (entry.result === 'win') acc.wins += 1;
        if (entry.result === 'loss') acc.losses += 1;
        if (entry.result === 'forfeit') acc.forfeits += 1;
        return acc;
      },
      { wins: 0, losses: 0, forfeits: 0 },
    );

    setDuelRecordSummary(summary);
    setDuelHistoryEntries(historyEntries);
  };

  const getPhaseAnnouncement = (phase: Phase) => {
    switch (phase) {
      case 'DP':
        return t('phaseDraw');
      case 'M1':
        return t('phaseMain1');
      case 'BP':
        return t('phaseBattle');
      case 'M2':
        return t('phaseMain2');
      case 'EP':
        return t('phaseEnd');
      default:
        return phase;
    }
  };

  const getPhaseInstruction = (phase: Phase, turn: 'player' | 'opponent') => {
    if (turn !== 'player') {
      switch (phase) {
        case 'DP':
          return t('phaseOpponentDp');
        case 'M1':
          return t('phaseOpponentM1');
        case 'BP':
          return t('phaseOpponentBp');
        case 'M2':
          return t('phaseOpponentM2');
        case 'EP':
          return t('phaseOpponentEp');
        default:
          return '';
      }
    }

    switch (phase) {
      case 'DP':
        return t('phasePlayerDp');
      case 'M1':
        return t('phasePlayerM1');
      case 'BP':
        return t('phasePlayerBp');
      case 'M2':
        return t('phasePlayerM2');
      case 'EP':
        return t('phasePlayerEp');
      default:
        return '';
    }
  };

  const getPhaseShortLabel = (phase: Phase) => {
    switch (phase) {
      case 'DP':
        return t('phaseDP');
      case 'M1':
        return t('phaseM1');
      case 'BP':
        return t('phaseBP');
      case 'M2':
        return t('phaseM2');
      case 'EP':
        return t('phaseEP');
      default:
        return phase;
    }
  };

  const getCompetitionSummaryStats = () => {
    if (!currentCompetitionOpponent) return null;
    const localizedContent = getLocalizedCompetitionContent(language, currentCompetitionOpponent.id, currentCompetitionOpponent);

    const turnsSurvived = Math.max(1, Math.ceil(state.turnCount / 2));
    const lpRemaining = state.winner === 'player' ? state.player.lp : state.opponent.lp;
    const finishingLog = [...state.log].reverse().find(entry =>
      entry.type === 'DIRECT_ATTACK' || entry.type === 'BATTLE_DAMAGE' || entry.type === 'MONSTER_DESTROYED',
    );
    const finishingCard =
      finishingLog?.data?.cardName ||
      [...state.log].reverse().find(entry => entry.type === 'SUMMON_MONSTER')?.data?.cardName ||
      null;

    return {
      turnsSurvived,
      lpRemaining,
      finishingCard,
      notablePlay: getCompetitionNotablePlay(state.log, language),
      summaryLine: state.winner === 'player'
        ? localizedContent.stageClearLine
        : localizedContent.defeatLine,
    };
  };

  const renderLazyScreenFallback = (label: string, embedded = false) => (
    <div className={`${embedded ? 'h-full' : 'h-dvh md:h-screen box-border pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:p-0'} theme-screen flex items-center justify-center font-mono uppercase tracking-widest`}>
      <div className="theme-panel px-6 py-4 text-sm theme-muted">
        {t('loading', { label })}
      </div>
    </div>
  );

  const renderMobilePlayHome = () => (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      <div className="mx-auto flex max-w-md flex-col gap-3">
        <button
          type="button"
          onClick={openCpuModeSelection}
          className="theme-panel rounded-[12px] px-3.5 py-3.5 text-left transition-colors hover:border-[var(--app-border-strong)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="theme-eyebrow text-[8px]">{t('playHomeQuickDuel')}</div>
              <div className="theme-title mt-1.5 text-[13px] uppercase tracking-[0.05em]">{t('cpuMode')}</div>
              <div className="theme-muted mt-1.5 text-[11px] leading-5">
                {t('playHomeCpuDescription')}
              </div>
            </div>
            <div className="theme-elevated flex h-8 w-8 items-center justify-center rounded-[8px]">
              <Swords size={11} />
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={startCompetitionMode}
          className="theme-panel rounded-[12px] px-3.5 py-3.5 text-left transition-colors hover:border-[var(--app-border-strong)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="theme-eyebrow text-[8px]">{t('playHomeLadder')}</div>
              <div className="theme-title mt-1.5 text-[13px] uppercase tracking-[0.05em]">{t('competition')}</div>
              <div className="theme-muted mt-1.5 text-[11px] leading-5">
                {competitionResumeOpponent
                  ? t('playHomeCompetitionDescription', {
                      stage: competitionResumeStageIndex + 1,
                      name: competitionResumeOpponent.name,
                    })
                  : t('playHomeCompetitionFallback')}
              </div>
            </div>
            <div className="theme-elevated flex h-8 w-8 items-center justify-center rounded-[8px]">
              <Trophy size={11} />
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleMobileTabChange('deck-builder')}
          className="theme-panel rounded-[8px] border px-3 py-3 text-left transition-colors hover:border-[var(--app-border-strong)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="theme-eyebrow text-[8px]">{t('playHomePrimaryDeck')}</div>
              <div className="theme-title mt-1 text-[12px] uppercase tracking-[0.04em]">
                {primaryDeckSummary?.name ?? t('primaryDeckDefault')}
              </div>
              <div className="theme-muted mt-1 text-[10px] leading-4.5">
                {primaryDeckSummary
                  ? `${primaryDeckSummary.mainCount}/60 ${t('mainLabel')} | ${primaryDeckSummary.extraCount}/15 ${t('extraLabel')}`
                  : t('loadingDeckStatus')}
              </div>
            </div>
            <div className={`text-[8px] font-mono uppercase tracking-[0.12em] ${primaryDeckSummary?.valid ?? true ? 'theme-subtle' : 'theme-danger'}`}>
              {primaryDeckSummary?.valid ?? true ? t('readyToDuel') : t('needs40Cards')}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMobileHistoryExpanded((previous) => !previous)}
          className="theme-panel rounded-[8px] border px-3 py-3 text-left transition-colors hover:border-[var(--app-border-strong)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="theme-eyebrow text-[8px]">{t('history')}</div>
              <div className="theme-title mt-1 text-[12px] uppercase tracking-[0.04em]">{t('duelHistory')}</div>
              <div className="theme-muted mt-1 text-[10px] leading-4.5">
                {t('gamesPlayed')}: {duelHistoryEntries.length}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="grid grid-cols-3 gap-1.5">
                <div className="flex min-w-[28px] flex-col items-center border border-[var(--app-border)] px-1 py-1">
                  <div className="theme-eyebrow text-[7px]">{t('wins')}</div>
                  <div className="mt-0.5 text-[10px] font-mono text-[var(--app-text-primary)]">{duelRecordSummary.wins}</div>
                </div>
                <div className="flex min-w-[28px] flex-col items-center border border-[var(--app-border)] px-1 py-1">
                  <div className="theme-eyebrow text-[7px]">{t('losses')}</div>
                  <div className="mt-0.5 text-[10px] font-mono text-[var(--app-text-primary)]">{duelRecordSummary.losses}</div>
                </div>
                <div className="flex min-w-[28px] flex-col items-center border border-[var(--app-border)] px-1 py-1">
                  <div className="theme-eyebrow text-[7px]">{t('forfeits')}</div>
                  <div className="mt-0.5 text-[10px] font-mono text-[var(--app-text-primary)]">{duelRecordSummary.forfeits}</div>
                </div>
              </div>
              <div className="theme-button-subtle flex h-6 w-6 items-center justify-center p-0">
                {mobileHistoryExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </div>
            </div>
          </div>
          {mobileHistoryExpanded ? (
            <div className="mt-3 space-y-2 border-t border-[var(--app-border)] pt-3">
              {duelHistoryEntries.length === 0 ? (
                <div className="theme-subtle py-6 text-center text-[10px] font-mono uppercase tracking-[0.12em]">
                  {t('noDuelHistoryYet')}
                </div>
              ) : (
                duelHistoryEntries.slice(0, 4).map((entry) => (
                  <div key={entry.id}>
                    <DuelHistoryEntryCard
                      entry={entry}
                      compact
                      onClick={() => {
                        setSelectedHistoryEntryId(entry.id);
                        setMobileHistorySheetExpanded(false);
                      }}
                    />
                  </div>
                ))
              )}
            </div>
          ) : null}
        </button>

        <section className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleMobileTabChange('deck-builder')}
            className="theme-panel rounded-[12px] px-3 py-3 text-left transition-colors hover:border-[var(--app-border-strong)]"
          >
            <div className="theme-eyebrow text-[8px]">{t('deckBuilder')}</div>
            <div className="theme-title mt-1.5 text-[11px] uppercase tracking-[0.06em]">{t('cardLibrary')}</div>
            <div className="theme-muted mt-1 text-[9px] leading-4.5">{t('decks')}</div>
          </button>

          <button
            type="button"
            onClick={() => handleMobileTabChange('rules')}
            className="theme-panel rounded-[12px] px-3 py-3 text-left transition-colors hover:border-[var(--app-border-strong)]"
          >
            <div className="theme-eyebrow text-[8px]">{t('duelRules')}</div>
            <div className="theme-title mt-1.5 text-[11px] uppercase tracking-[0.06em]">{t('gameplayRules')}</div>
            <div className="theme-muted mt-1 text-[9px] leading-4.5">{t('howToPlay')}</div>
          </button>
        </section>
      </div>
    </div>
  );

  const getDisplayLogMessage = (logEntry: LogEntry) => {
    if (gameMode === 'competition' && currentCompetitionOpponent) {
      return formatCompetitionLogMessage(logEntry, currentCompetitionOpponent, language);
    }

    return formatLogEntryMessage(logEntry, language);
  };

  // Center-screen announcements for duel log entries
  useEffect(() => {
    if (state.log.length < prevLogLengthRef.current) {
      prevLogLengthRef.current = 0;
    }

    if (state.log.length > prevLogLengthRef.current) {
      const newLogs = state.log.slice(prevLogLengthRef.current);
      announce(newLogs.map((entry) => ({
        title: t('duelEvent'),
        message: getDisplayLogMessage(entry),
      })));
      prevLogLengthRef.current = state.log.length;
    }
  }, [state.log, gameMode, currentCompetitionOpponent, announce, t]);

  useEffect(() => {
    hydrateProfile(userProfile);
  }, [userProfile, hydrateProfile]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        void withTimeout(
          initializeGameContent(),
          { source: 'local' as const, bundle: null as never },
          BOOT_TIMEOUT_MS,
        );

        const user = await withTimeout(getCurrentUser(), null, AUTH_GATE_TIMEOUT_MS);
        const resolvedProfile = user
          ? await withTimeout(
              ensureProfile(user),
              toUserProfile(user, null),
              AUTH_GATE_TIMEOUT_MS,
            )
          : null;

        authBootstrapResolvedRef.current = true;
        setUserProfile(resolvedProfile);
        setAuthCheckComplete(true);
        setAuthPromptDismissed(false);

        void withTimeout(ensureStarterCustomDeck(), null);
        void withTimeout(
          getCompetitionProgress(COMPETITION_LADDER.length),
          {
            currentStageIndex: 0,
            lastClearedStage: -1,
            updatedAt: new Date().toISOString(),
          },
        ).then((progress) => {
          setCompetitionResumeStageIndex(progress.currentStageIndex);
        });

        void withTimeout(getUserDeckState(), null).then((deckState) => {
          if (!deckState) return;
          const activeDeck = deckState.decks.find((deck) => deck.id === deckState.primaryDeckId) ?? deckState.decks[0];
          if (!activeDeck) return;

          setPrimaryDeckSummary({
            name: activeDeck.name,
            mainCount: activeDeck.mainDeck.length,
            extraCount: activeDeck.extraDeck.length,
            valid: activeDeck.mainDeck.length >= 40 && activeDeck.mainDeck.length <= 60,
          });
        });

        void refreshDuelRecordSummary();

        if (user) {
          void withTimeout(ensureProfile(user), null).then((profile) => {
            if (profile) {
              setUserProfile(profile);
            }
          });
        }
      } catch {
        authBootstrapResolvedRef.current = true;
        setBootState('error');
        setAuthCheckComplete(true);
      } finally {
        // Initial auth gate has resolved or timed out.
      }
    };

    const unsubscribe = onAuthStateChange((profile) => {
      setUserProfile(profile);
      if (profile || authBootstrapResolvedRef.current) {
        setAuthCheckComplete(true);
      }
      if (profile) {
        setAuthPromptDismissed(false);
      }
    });

    void bootstrap();

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (view === 'start') setMobileTab('play');
    if (view === 'deck-builder') setMobileTab('deck-builder');
    if (view === 'how-to-play') setMobileTab('rules');
  }, [view]);

  useEffect(() => {
    if (gameMode !== 'competition' || competitionStageIndex === null) return;

    if (!state.winner) {
      void setCompetitionProgress(competitionStageIndex).then((progress) => {
        setCompetitionResumeStageIndex(progress.currentStageIndex);
      });
      return;
    }

    if (state.winner === 'player') {
      const nextStageIndex = competitionStageIndex + 1;
      if (nextStageIndex >= COMPETITION_LADDER.length) {
        void clearCompetitionProgress().then(() => setCompetitionResumeStageIndex(0));
      } else {
        void setCompetitionProgress(nextStageIndex).then((progress) => {
          setCompetitionResumeStageIndex(progress.currentStageIndex);
        });
      }
      return;
    }

    void setCompetitionProgress(competitionStageIndex).then((progress) => {
      setCompetitionResumeStageIndex(progress.currentStageIndex);
    });
  }, [gameMode, competitionStageIndex, state.winner]);

  useEffect(() => {
    if (!state.winner || pendingCpuModeSelection || duelHistorySavedRef.current === `${state.turnCount}-${state.winner}`) {
      return;
    }

    const saveHistory = async () => {
      const summary = getCompetitionSummaryStats();
      const fallbackNotablePlay = [...state.log].reverse().find((entry) => entry.message)?.message ?? t('duelEndedWithoutStandoutPlay');
      const finishingCard =
        [...state.log].reverse().find((entry) => entry.data?.cardName)?.data?.cardName ?? null;

      const historyEntry: DuelHistoryEntry = {
        id: `duel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mode: gameMode === 'competition' ? 'competition' : gameMode === 'custom' ? 'cpu_custom' : 'cpu_random',
        opponentLabel:
          localizedCompetitionContent?.name ??
          (gameMode === 'custom' ? t('cpuCustomLabel') : t('cpuRandomLabel')),
        stageIndex: competitionStageIndex,
        result: state.winner === 'player' ? 'win' : 'loss',
        turnCount: state.turnCount,
        lpRemaining: state.winner === 'player' ? state.player.lp : state.opponent.lp,
        finishingCard,
        notablePlay: summary?.notablePlay ?? fallbackNotablePlay,
        summary: summary?.summaryLine ?? (state.winner === 'player' ? t('victoryLog') : t('defeatLog')),
        logs: state.log,
        createdAt: new Date().toISOString(),
      };

      await appendDuelHistoryEntry(historyEntry);
      await refreshDuelRecordSummary();
      duelHistorySavedRef.current = `${state.turnCount}-${state.winner}`;
    };

    void saveHistory();
  }, [state.winner, state.turnCount, state.log, state.player.lp, state.opponent.lp, pendingCpuModeSelection, gameMode, competitionStageIndex, currentCompetitionOpponent]);

  useEffect(() => {
    if (view === 'game') {
      setMobileInfoExpanded(false);
    }
  }, [view]);

  useEffect(() => {
    if (view !== 'game' || pendingCpuModeSelection || state.winner) {
      prevPlayerPhaseKeyRef.current = null;
      return;
    }

    const phaseKey = `${state.turn}-${state.turnCount}-${state.phase}`;
    if (state.turn !== 'player') {
      prevPlayerPhaseKeyRef.current = phaseKey;
      return;
    }

    if (prevPlayerPhaseKeyRef.current !== phaseKey) {
      announce({ title: 'Current Phase', message: getPhaseAnnouncement(state.phase) });
      prevPlayerPhaseKeyRef.current = phaseKey;
    }
  }, [view, pendingCpuModeSelection, state.winner, state.turn, state.turnCount, state.phase, announce]);

  useEffect(() => {
    if (view !== 'game' || !mobileBattlefieldRef.current || state.turnCount !== 1) return;

    const frame = window.requestAnimationFrame(() => {
      const mobileBattlefield = mobileBattlefieldRef.current;
      if (!mobileBattlefield) return;
      mobileBattlefield.scrollTop = mobileBattlefield.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [view, state.turnCount]);

  const loadPrimaryDeck = async () => {
    const primaryDeck = (await getPrimaryDeckSnapshot()) ?? (await ensureStarterCustomDeck());
    if (!primaryDeck?.mainDeck || primaryDeck.mainDeck.length < 40) {
      return null;
    }

    return {
      playerDeck: primaryDeck.mainDeck,
      playerExtraDeck: primaryDeck.extraDeck,
    };
  };

  const launchGame = ({
    playerDeck,
    opponentDeck,
    playerExtraDeck,
    opponentExtraDeck,
    mode,
    stageIndex = null,
  }: {
    playerDeck: string[];
    opponentDeck: string[];
    playerExtraDeck?: string[];
    opponentExtraDeck?: string[];
    mode: 'random' | 'custom' | 'competition';
    stageIndex?: number | null;
  }) => {
    prevLogLengthRef.current = 0;
    prevPlayerPhaseKeyRef.current = null;
    duelHistorySavedRef.current = null;
    clearAnnouncements();
    setUiState({ type: 'IDLE' });
    setGameMode(mode);
    setCompetitionStageIndex(stageIndex);
    setPendingCpuModeSelection(false);
    setShowMobileAccountSheet(false);
    setMobileSheetExpanded(false);
    if (mode !== 'competition') {
      setShowCompetitionIntro(false);
    }
    dispatch({ 
      type: 'START_GAME', 
      playerDeck,
      opponentDeck,
      playerExtraDeck,
      opponentExtraDeck
    });
    setView('game');
  };

  const returnToMenu = () => {
    setView('start');
    setMobileTab('play');
    setGameMode(null);
    setCompetitionStageIndex(null);
    setPendingCpuModeSelection(false);
    setShowCompetitionLobby(false);
    setShowCompetitionIntro(false);
    setShowMenuConfirm(false);
    setUiState({ type: 'IDLE' });
    prevPlayerPhaseKeyRef.current = null;
    duelHistorySavedRef.current = null;
  };

  const dismissAuthPrompt = () => {
    setAuthPromptDismissed(true);
  };

  const handleMobileTabChange = (tab: MobileTabId) => {
    setMobileTab(tab);
    setShowMobileAccountSheet(false);
    setSelectedHistoryEntryId(null);

    if (tab === 'play') setView('start');
    if (tab === 'deck-builder') setView('deck-builder');
    if (tab === 'rules') setView('how-to-play');
  };

  const handleHomeAuthAction = async () => {
    if (!userProfile) {
      setView('sign-in');
      return;
    }

    await signOut();
    setUserProfile(null);
    setAuthCheckComplete(true);
    setAuthPromptDismissed(false);
    setShowMobileAccountSheet(false);
  };

  const forfeitToMenu = async () => {
    if (hasActiveDuel) {
      await appendDuelHistoryEntry({
        id: `duel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mode: gameMode === 'competition' ? 'competition' : gameMode === 'custom' ? 'cpu_custom' : 'cpu_random',
        opponentLabel:
          localizedCompetitionContent?.name ??
          (gameMode === 'custom' ? t('cpuCustomLabel') : t('cpuRandomLabel')),
        stageIndex: competitionStageIndex,
        result: 'forfeit',
        turnCount: state.turnCount,
        lpRemaining: state.player.lp,
        finishingCard: null,
        notablePlay: getCompetitionNotablePlay(state.log, language),
        summary: t('forfeitSummary'),
        logs: state.log,
        createdAt: new Date().toISOString(),
      });
      await refreshDuelRecordSummary();
    }

    returnToMenu();
  };

  const handleMenuClick = () => {
    if (!hasActiveDuel) {
      returnToMenu();
      return;
    }

    setShowMenuConfirm(true);
  };

  const startRandomGame = () => {
    launchGame({
      playerDeck: generateCuratedDeck(),
      opponentDeck: generateCuratedDeck(),
      playerExtraDeck: generateCuratedExtraDeck(),
      opponentExtraDeck: generateCuratedExtraDeck(),
      mode: 'random',
    });
  };

  const startCustomGame = async () => {
    const deckData = await loadPrimaryDeck();

    if (!deckData) {
      showNotice(t('customDeckRequired'), t('deckRequired'));
      return;
    }

    launchGame({
      playerDeck: deckData.playerDeck,
      playerExtraDeck: deckData.playerExtraDeck,
      opponentDeck: generateCuratedDeck(),
      opponentExtraDeck: generateCuratedExtraDeck(),
      mode: 'custom',
    });
  };

  const startCompetitionDuel = async (stageIndex: number) => {
    const deckData = await loadPrimaryDeck();

    if (!deckData) {
      showNotice(t('competitionModeDeckRequired'), t('deckRequired'));
      return;
    }

    const opponent = COMPETITION_LADDER[stageIndex];
    if (!opponent) return;

    setShowCompetitionLobby(false);
    setShowCompetitionIntro(true);
    launchGame({
      playerDeck: deckData.playerDeck,
      playerExtraDeck: deckData.playerExtraDeck,
      opponentDeck: opponent.mainDeck,
      opponentExtraDeck: opponent.extraDeck,
      mode: 'competition',
      stageIndex,
    });
  };

  const startCompetitionMode = () => {
    setShowCompetitionLobby(true);
    setView('start');
  };

  const openCpuModeSelection = () => {
    if (isMobile) {
      setPendingCpuModeSelection(true);
      setView('start');
      return;
    }

    prevLogLengthRef.current = state.log.length;
    prevPlayerPhaseKeyRef.current = null;
    clearAnnouncements();
    setUiState({ type: 'IDLE' });
    setGameMode(null);
    setCompetitionStageIndex(null);
    setPendingCpuModeSelection(true);
    setView('game');
  };

  const advanceCompetition = () => {
    if (competitionStageIndex === null) {
      returnToMenu();
      return;
    }

    const nextStageIndex = competitionStageIndex + 1;
    if (nextStageIndex >= COMPETITION_LADDER.length) {
      void clearCompetitionProgress().then(() => setCompetitionResumeStageIndex(0));
      showNotice(t('competitionCleared'), t('competition'));
      returnToMenu();
      return;
    }

    void startCompetitionDuel(nextStageIndex);
  };

  const getMenuPromptContent = () => {
    if (gameMode === 'competition' && currentCompetitionOpponent) {
      return {
        eyebrow: t('stageHeading', { stage: currentCompetitionOpponent.stage, total: currentCompetitionOpponent.totalStages }),
        title: t('forfeitDuelQuestion'),
        message: localizedCompetitionContent?.forfeitLine || currentCompetitionOpponent.voice.forfeit,
        detail: t('forfeitStageProgress', { name: localizedCompetitionContent?.name || currentCompetitionOpponent.name }),
        confirmLabel: t('forfeitDuel'),
        cancelLabel: t('stayInDuel'),
      };
    }

    if (gameMode === 'custom') {
      return {
        eyebrow: t('cpuPromptCustomEyebrow'),
        title: t('forfeitDuelQuestion'),
        message: t('cpuPromptCustomMessage'),
        detail: t('cpuPromptCustomDetail'),
        confirmLabel: t('forfeitDuel'),
        cancelLabel: t('stayInDuel'),
      };
    }

    return {
      eyebrow: t('cpuPromptRandomEyebrow'),
      title: t('forfeitDuelQuestion'),
      message: t('cpuPromptRandomMessage'),
      detail: t('cpuPromptRandomDetail'),
      confirmLabel: t('forfeitDuel'),
      cancelLabel: t('stayInDuel'),
    };
  };

  const menuPromptContent = getMenuPromptContent();
  const getLocalizedCardMeta = (card: GameCard) => {
    const localizedText = getLocalizedCardText(card, language);
    const typeLabel = t(getCardTypeTranslationKey(card.type));
    const subtypeKey = getCardSubtypeTranslationKey(card.subType);
    const subtypeLabel = subtypeKey ? t(subtypeKey) : null;
    return { ...localizedText, typeLabel, subtypeLabel };
  };

  const renderPhaseTracker = (className = 'flex gap-3 text-xs font-mono') => (
    <div className={className}>
      {['DP', 'M1', 'BP', 'M2', 'EP'].map((p) => (
        <motion.span
          key={p}
          animate={{
            y: state.phase === p && !reduced ? -1 : 0,
          }}
          transition={getSharedTransition(reduced, 'fast')}
          className={state.phase === p ? 'font-bold text-[var(--app-text-primary)]' : 'text-[var(--app-text-dim)]'}
        >
          {p}
        </motion.span>
      ))}
    </div>
  );

  const handleMobileInfoTabChange = (tab: 'details' | 'log') => {
    if (mobileInfoTab === tab) {
      setMobileInfoExpanded((prev) => !prev);
      return;
    }

    setMobileInfoTab(tab);
    setMobileInfoExpanded(true);
  };

  const renderCardDetailPanel = (emptyMessage: string) => {
    if (!showCardDetail) {
      return (
        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={getSharedTransition(reduced, 'fast')}
          className="text-zinc-600 text-xs font-mono uppercase tracking-widest text-center"
        >
          {emptyMessage}
        </motion.div>
      );
    }

    const supportMeta = getCardSupportMeta(showCardDetail);
    const localizedCard = getLocalizedCardMeta(showCardDetail);
    return (
      <motion.div
        key={showCardDetail.instanceId}
        initial={{ opacity: 0, y: reduced ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={getSharedTransition(reduced, 'fast')}
        className="w-full max-w-[220px] rounded border border-zinc-700 p-4 flex flex-col bg-black"
      >
        <div className="font-sans text-xl font-bold leading-tight mb-2 text-white uppercase tracking-wider">{localizedCard.name}</div>
        <div className="text-[10px] font-mono text-zinc-500 mb-4 uppercase tracking-widest border-b border-zinc-800 pb-2 flex justify-between gap-2">
          <span>[{localizedCard.typeLabel}{localizedCard.subtypeLabel ? ` / ${localizedCard.subtypeLabel}` : ''}]</span>
          {showCardDetail.type === 'Monster' && (
            <span>LVL {showCardDetail.level} {showCardDetail.level! >= 7 ? `(${t('helpTwoTributes')})` : showCardDetail.level! >= 5 ? `(${t('helpOneTribute')})` : ''}</span>
          )}
        </div>
        <div className="text-xs text-zinc-400 font-sans leading-relaxed">
          {localizedCard.description}
        </div>
        {(showCardDetail.type !== 'Monster' || supportMeta.status !== 'implemented') && (
          <div className="mt-4 border-t border-zinc-800 pt-3 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
            <div className="text-zinc-400">{t(getLocalizedSupportStatusKey(supportMeta.status))}</div>
            {supportMeta.note && <div className="mt-1 normal-case tracking-normal text-zinc-500">{supportMeta.note}</div>}
          </div>
        )}
        {showCardDetail.type === 'Monster' && (
          <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between font-mono text-sm text-zinc-300">
            <span>ATK {showCardDetail.atk}</span>
            <span>DEF {showCardDetail.def}</span>
          </div>
        )}
        {showCardDetail.isFusion && showCardDetail.fusionMaterials && (
          <div className="mt-4 border-t border-zinc-800 pt-3">
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">{t('fusionMaterials')}</div>
            <div className="mt-1 text-[11px] text-zinc-300 leading-5">{showCardDetail.fusionMaterials.join(' + ')}</div>
          </div>
        )}
      </motion.div>
    );
  };

  const renderMobileCardDetailPanel = (emptyMessage: string) => {
    if (!showCardDetail) {
      return (
        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={getSharedTransition(reduced, 'fast')}
          className="text-zinc-600 text-[8px] font-mono uppercase tracking-[0.12em] leading-4 text-center px-3"
        >
          {emptyMessage}
        </motion.div>
      );
    }

    const supportMeta = getCardSupportMeta(showCardDetail);
    const localizedCard = getLocalizedCardMeta(showCardDetail);
    return (
      <motion.div
        key={showCardDetail.instanceId}
        initial={{ opacity: 0, y: reduced ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={getSharedTransition(reduced, 'fast')}
        className="w-full rounded-[8px] border border-zinc-800 bg-black"
      >
        <div className="border-b border-zinc-800 px-3 py-2">
          <div className="text-[11px] font-sans font-bold leading-tight text-white uppercase tracking-[0.02em]">
            {localizedCard.name}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[6px] font-mono uppercase tracking-[0.08em] text-zinc-400">
            <span className="border border-zinc-800 bg-zinc-950 px-1.5 py-1">
              {localizedCard.typeLabel}
              {localizedCard.subtypeLabel ? ` / ${localizedCard.subtypeLabel}` : ''}
            </span>
            {showCardDetail.type === 'Monster' && (
              <span className="border border-zinc-800 bg-zinc-950 px-1.5 py-1">
                Lvl {showCardDetail.level}
              </span>
            )}
            {showCardDetail.type === 'Monster' && (
              <span className="border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-zinc-500">
                {showCardDetail.level! >= 7 ? t('helpTwoTributes') : showCardDetail.level! >= 5 ? t('helpOneTribute') : t('helpNoTributes')}
              </span>
            )}
          </div>
        </div>

        <div className="px-3 py-2 space-y-2">
          {showCardDetail.type === 'Monster' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[6px] border border-zinc-800 bg-zinc-950 px-2 py-1.5">
                <div className="text-[6px] font-mono uppercase tracking-[0.08em] text-zinc-500">ATK</div>
                <div className="mt-1 text-[10px] font-mono text-white">{showCardDetail.atk}</div>
              </div>
              <div className="rounded-[6px] border border-zinc-800 bg-zinc-950 px-2 py-1.5">
                <div className="text-[6px] font-mono uppercase tracking-[0.08em] text-zinc-500">DEF</div>
                <div className="mt-1 text-[10px] font-mono text-white">{showCardDetail.def}</div>
              </div>
            </div>
          )}

          <div className="text-[10px] leading-4.5 text-zinc-300">
            {localizedCard.description}
          </div>

          {(showCardDetail.type !== 'Monster' || supportMeta.status !== 'implemented') && (
            <div className="rounded-[6px] border border-zinc-800 bg-zinc-950 px-2.5 py-2">
              <div className="text-[6px] font-mono uppercase tracking-[0.08em] text-zinc-500 mb-1">
                {t(getLocalizedSupportStatusKey(supportMeta.status))}
              </div>
              {supportMeta.note && (
                <div className="text-[8px] text-zinc-300 leading-4">
                  {supportMeta.note}
                </div>
              )}
            </div>
          )}

          {showCardDetail.isFusion && showCardDetail.fusionMaterials && (
            <div className="rounded-[6px] border border-zinc-800 bg-zinc-950 px-2.5 py-2">
              <div className="text-[6px] font-mono uppercase tracking-[0.08em] text-zinc-500 mb-1">
                {t('fusionMaterials')}
              </div>
              <div className="text-[8px] text-zinc-300 leading-4">
                {showCardDetail.fusionMaterials.join(' + ')}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const renderDuelLogPanel = (compact = false) => (
    <div className={`flex-grow overflow-y-auto flex flex-col ${compact ? 'gap-1 text-[9px]' : 'gap-2 text-[11px]'} font-mono text-zinc-400`}>
      {[...state.log].reverse().map((entry, i) => {
        const isPlayer = entry.data?.player === 'player' || entry.data?.nextTurn === 'player';
        const isOpponent = entry.data?.player === 'opponent' || entry.data?.nextTurn === 'opponent';
        const isBoth = entry.data?.player === 'both';
        const displayMessage = getDisplayLogMessage(entry);
        
        let textColor = 'text-zinc-400';
        let prefix = '';
        
        if (entry.type === 'DUEL_START') {
          textColor = 'text-yellow-400';
          prefix = `[${t('actorSystem')}] `;
        } else if (entry.type === 'NEXT_TURN') {
          textColor = isPlayer ? 'text-blue-400' : 'text-red-400';
          prefix = isPlayer ? `[${t('actorYou')}] ` : `[${opponentShortLabel}] `;
        } else if (isPlayer) {
          textColor = 'text-blue-400';
          prefix = `[${t('actorYou')}] `;
        } else if (isOpponent) {
          textColor = 'text-red-400';
          prefix = currentCompetitionOpponent ? `[${opponentShortLabel}] ` : `[${t('actorOpponent')}] `;
        } else if (isBoth) {
          textColor = 'text-purple-400';
          prefix = `[${t('actorBoth')}] `;
        }

        return (
          <div key={entry.id || i} className={`border-b border-zinc-900 ${compact ? 'pb-1 leading-4.5' : 'pb-2'} ${textColor}`}>
            {prefix && <span className="opacity-50 mr-1">{prefix}</span>}
            {displayMessage}
          </div>
        );
      })}
    </div>
  );

  const openMonsterRebornZoneSelection = (
    targetPlayer: 'player' | 'opponent',
    spellCard: GameCard,
    fromZone?: number,
  ) => {
    const graveyard = state[targetPlayer].graveyard;
    const cards = graveyard
      .map((card, sourceIndex) => card.type === 'Monster' ? { card, sourceIndex } : null)
      .filter(Boolean) as { card: GameCard, sourceIndex: number }[];

    if (cards.length === 0) {
      showNotice(
        t('noMonstersInSelectedGraveyard', {
          owner: targetPlayer === 'player' ? t('yourGraveyard') : t('opponentGraveyard'),
        }),
        t('noTarget'),
      );
      return;
    }

    setUiState({
      type: 'SELECT_ZONE_CARD',
      title: t('selectMonsterFromGraveyardTitle', {
        owner: targetPlayer === 'player' ? t('yourGraveyard') : t('opponentGraveyard'),
      }),
      description: t('monsterRebornZoneDescription'),
      zone: 'graveyard',
      owner: targetPlayer,
      cards,
      purpose: {
        type: 'MONSTER_REBORN',
        spellCard,
        fromZone,
        targetPlayer,
      },
    });
  };

  const getLegacyPlayerResponseOptions = (
    pendingAction:
      | { type: 'SUMMON_MONSTER', player: 'opponent', cardInstanceId: string, position: 'attack' | 'set-monster', tributes: number[] }
      | { type: 'FUSION_SUMMON', player: 'opponent', fusionMonsterId: string, materialInstanceIds: string[], spellInstanceId: string, fromZone?: number }
      | { type: 'DECLARE_ATTACK', attackerIndex: number, targetIndex: number | null },
  ) => {
    return state.player.spellTrapZone.flatMap((card, fromZone) => {
      if (!card || card.position !== 'set-spell') return [];

      if (pendingAction.type === 'DECLARE_ATTACK' && card.id === 'negate-attack') {
        return [{
          card,
          fromZone,
          title: 'Activate Negate Attack',
          description: 'Negate the attack and end the Battle Phase.',
        }];
      }

      if (pendingAction.type === 'DECLARE_ATTACK') {
        if (card.id === 'mirror-force') {
          return [{
            card,
            fromZone,
            title: 'Activate Mirror Force',
            description: 'Destroy all of the opponent’s Attack Position monsters.',
          }];
        }

        if (card.id === 'magic-cylinder') {
          return [{
            card,
            fromZone,
            title: 'Activate Magic Cylinder',
            description: 'Negate the attack and inflict damage equal to the attacker’s ATK.',
          }];
        }

        return [];
      }

      if (card.id !== 'trap-hole') return [];

      if (pendingAction.type === 'SUMMON_MONSTER') {
        const summonedCard = state.opponent.hand.find(c => c.instanceId === pendingAction.cardInstanceId);
        if (pendingAction.position === 'attack' && (summonedCard?.atk || 0) >= 1000) {
          return [{
            card,
            fromZone,
            title: 'Activate Trap Hole',
            description: `Destroy ${summonedCard.name} after it is summoned.`,
          }];
        }
      }

      if (pendingAction.type === 'FUSION_SUMMON') {
        const fusionMonster = state.opponent.extraDeck.find(c => c.id === pendingAction.fusionMonsterId);
        if ((fusionMonster?.atk || 0) >= 1000) {
          return [{
            card,
            fromZone,
            title: 'Activate Trap Hole',
            description: `Destroy ${fusionMonster.name} after it is Fusion Summoned.`,
          }];
        }
      }

      return [];
    });
  };

  const getPlayerResponseOptions = (
    pendingAction:
      | { type: 'SUMMON_MONSTER', player: 'opponent', cardInstanceId: string, position: 'attack' | 'set-monster', tributes: number[] }
      | { type: 'FUSION_SUMMON', player: 'opponent', fusionMonsterId: string, materialInstanceIds: string[], spellInstanceId: string, fromZone?: number }
      | { type: 'DECLARE_ATTACK', attackerIndex: number, targetIndex: number | null },
  ) => {
    const trigger =
      pendingAction.type === 'DECLARE_ATTACK'
        ? (() => {
            const attacker = state.opponent.monsterZone[pendingAction.attackerIndex];
            return attacker
              ? {
                  type: 'attack_declared' as const,
                  actingPlayer: 'opponent' as const,
                  attacker,
                  attackerIndex: pendingAction.attackerIndex,
                  targetIndex: pendingAction.targetIndex,
                }
              : null;
          })()
        : pendingAction.type === 'SUMMON_MONSTER'
          ? (() => {
              const summonedCard = state.opponent.hand.find(card => card.instanceId === pendingAction.cardInstanceId);
              return summonedCard
                ? {
                    type: 'monster_summoned' as const,
                    actingPlayer: 'opponent' as const,
                    summonedCard,
                    zoneIndex: 0,
                    summonKind: 'normal' as const,
                    position: pendingAction.position,
                  }
                : null;
            })()
          : (() => {
              const fusionMonster = state.opponent.extraDeck.find(card => card.id === pendingAction.fusionMonsterId);
              return fusionMonster
                ? {
                    type: 'monster_summoned' as const,
                    actingPlayer: 'opponent' as const,
                    summonedCard: fusionMonster,
                    zoneIndex: 0,
                    summonKind: 'fusion' as const,
                    position: 'attack' as const,
                  }
                : null;
            })();

    if (!trigger) return [];
    return getResponseWindowOptions(state.player, playerActivationContext, trigger);
  };

  void getLegacyPlayerResponseOptions;

  const maybePromptPlayerResponse = (
    pendingAction:
      | { type: 'SUMMON_MONSTER', player: 'opponent', cardInstanceId: string, position: 'attack' | 'set-monster', tributes: number[] }
      | { type: 'FUSION_SUMMON', player: 'opponent', fusionMonsterId: string, materialInstanceIds: string[], spellInstanceId: string, fromZone?: number }
      | { type: 'DECLARE_ATTACK', attackerIndex: number, targetIndex: number | null },
  ) => {
    const options = getPlayerResponseOptions(pendingAction);

    if (options.length === 0) return false;

    setUiState({
      type: 'CONFIRM_RESPONSE',
      message: t('responsePromptActivateCard'),
      options,
      pendingAction,
    });

    return true;
  };

  const resolvePendingResponse = (selectedCardInstanceId?: string) => {
    if (uiState.type !== 'CONFIRM_RESPONSE') return;

    const responseOverrides = Object.fromEntries(
      uiState.options.map(option => [option.card.instanceId, option.card.instanceId === selectedCardInstanceId]),
    );

    dispatch({
      ...uiState.pendingAction,
      responseOverrides,
    } as Action);

    setUiState({ type: 'IDLE' });
    setAiResumeTick(tick => tick + 1);
  };

  // AI Logic
  useEffect(() => {
    if (state.turn === 'opponent' && !state.winner && uiState.type !== 'CONFIRM_RESPONSE' && !showCompetitionIntro) {
      const runAI = async () => {
        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
        
        if (state.phase === 'DP') {
          await delay(1000);
          dispatch({ type: 'DRAW_CARD', player: 'opponent' });
          await delay(1000);
          dispatch({ type: 'NEXT_PHASE' }); // to M1
        } else if (state.phase === 'M1') {
          await delay(1000);
          const aiSituation = {
            isBehind: state.opponent.lp < state.player.lp,
            opponentHasBackrow: state.player.spellTrapZone.some(Boolean),
            opponentHasMonsters: state.player.monsterZone.some(Boolean),
          };
          const competitionAiProfile = gameMode === 'competition' ? currentCompetitionOpponent?.aiProfile : null;
          const competitionSignatures = gameMode === 'competition' ? currentCompetitionOpponent?.signatureCardIds ?? [] : [];
          // AI Spells
          const spells = [...state.opponent.hand.filter(c => c.type === 'Spell')].sort(
            (a, b) =>
              getCompetitionAiScore(b, competitionAiProfile, competitionSignatures, aiSituation) -
              getCompetitionAiScore(a, competitionAiProfile, competitionSignatures, aiSituation),
          );
          for (const spell of spells) {
            if (spell.id === 'polymerization') {
              const fusionMonsters = state.opponent.extraDeck.filter(c => c.isFusion);
              let fusionSummoned = false;
              for (const fm of fusionMonsters) {
                if (!fm.fusionMaterials) continue;
                
                const availableCards = [...state.opponent.hand, ...state.opponent.monsterZone.filter(m => m !== null)] as GameCard[];
                let hasAll = true;
                let tempAvailable = [...availableCards];
                let fieldMaterialsUsed = 0;
                let selectedMaterialIds: string[] = [];
                
                for (const matName of fm.fusionMaterials) {
                  const idx = tempAvailable.findIndex(c => isMaterialMatch(c, matName));
                  if (idx !== -1) {
                    const card = tempAvailable[idx];
                    selectedMaterialIds.push(card.instanceId);
                    if (state.opponent.monsterZone.some(m => m?.instanceId === card.instanceId)) {
                      fieldMaterialsUsed++;
                    }
                    tempAvailable.splice(idx, 1);
                  } else {
                    hasAll = false;
                    break;
                  }
                }
                
                const hasEmptyZone = state.opponent.monsterZone.some(z => z === null);
                if (hasAll && (hasEmptyZone || fieldMaterialsUsed > 0)) {
                  const action: {
                    type: 'FUSION_SUMMON',
                    player: 'opponent',
                    fusionMonsterId: string,
                    materialInstanceIds: string[],
                    spellInstanceId: string,
                    fromZone?: number,
                  } = {
                    type: 'FUSION_SUMMON',
                    player: 'opponent',
                    fusionMonsterId: fm.id,
                    materialInstanceIds: selectedMaterialIds,
                    spellInstanceId: spell.instanceId
                  };
                  if (maybePromptPlayerResponse(action)) return;
                  dispatch(action);
                  fusionSummoned = true;
                  await delay(1000);
                  break; // Only one fusion summon per poly
                }
              }
              if (fusionSummoned) continue;
            } else if (spell.id === 'raigeki' || spell.id === 'dark-hole') {
              const playerHasMonsters = state.player.monsterZone.some(m => m !== null);
              if (playerHasMonsters) {
                dispatch({ type: 'ACTIVATE_SPELL', player: 'opponent', cardInstanceId: spell.instanceId });
                await delay(1000);
              }
            } else if (spell.id === 'fissure') {
              const playerHasFaceUpMonsters = state.player.monsterZone.some(m => m !== null && m.position !== 'set-monster');
              if (playerHasFaceUpMonsters) {
                dispatch({ type: 'ACTIVATE_SPELL', player: 'opponent', cardInstanceId: spell.instanceId });
                await delay(1000);
              }
            } else if (spell.id === 'tribute-to-the-doomed') {
              const discardCard = state.opponent.hand
                .filter(c => c.instanceId !== spell.instanceId)
                .sort((a, b) => (a.atk || 0) - (b.atk || 0))[0];
              const targetOptions = [
                ...state.player.monsterZone.map((card, index) => card ? { index, targetPlayer: 'player' as const, score: card.atk || card.def || 0 } : null),
                ...state.opponent.monsterZone.map((card, index) => card ? { index, targetPlayer: 'opponent' as const, score: card.atk || card.def || 0 } : null),
              ].filter(Boolean) as { index: number, targetPlayer: 'player' | 'opponent', score: number }[];
              targetOptions.sort((a, b) => b.score - a.score);
              const bestTarget = targetOptions[0];
              if (discardCard && bestTarget) {
                dispatch({
                  type: 'ACTIVATE_SPELL',
                  player: 'opponent',
                  cardInstanceId: spell.instanceId,
                  discardInstanceId: discardCard.instanceId,
                  targetIndex: bestTarget.index,
                  targetPlayer: bestTarget.targetPlayer,
                });
                await delay(1000);
              }
            } else if (spell.id === 'pot-of-greed') {
              dispatch({ type: 'ACTIVATE_SPELL', player: 'opponent', cardInstanceId: spell.instanceId });
              await delay(1000);
            } else if (spell.id === 'monster-reborn') {
              const hasEmptyZone = state.opponent.monsterZone.some(z => z === null);
              const rebornTargets = [
                ...state.player.graveyard.map((card, sourceIndex) => card.type === 'Monster' ? { owner: 'player' as const, sourceIndex, atk: card.atk || 0 } : null),
                ...state.opponent.graveyard.map((card, sourceIndex) => card.type === 'Monster' ? { owner: 'opponent' as const, sourceIndex, atk: card.atk || 0 } : null),
              ].filter(Boolean) as { owner: 'player' | 'opponent', sourceIndex: number, atk: number }[];
              rebornTargets.sort((a, b) => b.atk - a.atk);
              const bestTarget = rebornTargets[0];
              if (hasEmptyZone && bestTarget) {
                dispatch({
                  type: 'ACTIVATE_SPELL',
                  player: 'opponent',
                  cardInstanceId: spell.instanceId,
                  targetIndex: bestTarget.sourceIndex,
                  targetPlayer: bestTarget.owner,
                });
                await delay(1000);
              }
            } else if (spell.id === 'harpie-s-feather-duster') {
              const playerHasBackrow = state.player.spellTrapZone.some(c => c !== null);
              if (playerHasBackrow) {
                dispatch({ type: 'ACTIVATE_SPELL', player: 'opponent', cardInstanceId: spell.instanceId });
                await delay(1000);
              }
            } else if (spell.id === 'brain-control') {
              const hasEmptyZone = state.opponent.monsterZone.some(z => z === null);
              const targetOptions = state.player.monsterZone
                .map((card, index) => card && card.position !== 'set-monster' && !card.isFusion ? { index, atk: card.atk || 0 } : null)
                .filter(Boolean) as { index: number, atk: number }[];
              targetOptions.sort((a, b) => b.atk - a.atk);
              const bestTarget = targetOptions[0];
              if (state.opponent.lp >= 800 && hasEmptyZone && bestTarget) {
                dispatch({
                  type: 'ACTIVATE_SPELL',
                  player: 'opponent',
                  cardInstanceId: spell.instanceId,
                  targetIndex: bestTarget.index,
                  targetPlayer: 'player',
                });
                await delay(1000);
              }
            } else if (spell.id === 'de-spell') {
              const targetIndex = state.player.spellTrapZone.findIndex(c => c?.type === 'Spell');
              if (targetIndex !== -1) {
                dispatch({
                  type: 'ACTIVATE_SPELL',
                  player: 'opponent',
                  cardInstanceId: spell.instanceId,
                  targetIndex,
                  targetPlayer: 'player',
                });
                await delay(1000);
              }
            } else if (spell.id === 'hinotama') {
              dispatch({ type: 'ACTIVATE_SPELL', player: 'opponent', cardInstanceId: spell.instanceId });
              await delay(1000);
            }
          }

          // AI Summon
          if (!state.normalSummonUsed) {
            const monsters = [...state.opponent.hand.filter(c => c.type === 'Monster')].sort(
              (a, b) =>
                getCompetitionAiScore(b, competitionAiProfile, competitionSignatures, aiSituation) -
                getCompetitionAiScore(a, competitionAiProfile, competitionSignatures, aiSituation),
            );
            for (const m of monsters) {
              const level = m.level || 4;
              const tributesNeeded = level >= 7 ? 2 : level >= 5 ? 1 : 0;
              const availableTributes = state.opponent.monsterZone.map((card, idx) => card ? idx : -1).filter(idx => idx !== -1);
              
              if (availableTributes.length >= tributesNeeded) {
                // Sort tributes by lowest ATK
                availableTributes.sort((a, b) => (state.opponent.monsterZone[a]!.atk || 0) - (state.opponent.monsterZone[b]!.atk || 0));
                const tributesToUse = availableTributes.slice(0, tributesNeeded);
                const position = (m.atk || 0) < 1500 ? 'set-monster' : 'attack';
                const action: {
                  type: 'SUMMON_MONSTER',
                  player: 'opponent',
                  cardInstanceId: string,
                  position: 'attack' | 'set-monster',
                  tributes: number[],
                } = { type: 'SUMMON_MONSTER', player: 'opponent', cardInstanceId: m.instanceId, position, tributes: tributesToUse };
                if (maybePromptPlayerResponse(action)) return;
                dispatch(action);
                await delay(1000);
                break;
              }
            }
          }

          // AI Set Traps
          const traps = state.opponent.hand.filter(c => c.type === 'Trap');
          for (const trap of traps) {
            const emptyZoneIndex = state.opponent.spellTrapZone.findIndex(z => z === null);
            if (emptyZoneIndex !== -1) {
              dispatch({ type: 'SET_SPELL_TRAP', player: 'opponent', cardInstanceId: trap.instanceId });
              await delay(500);
            }
          }

          dispatch({ type: 'NEXT_PHASE' }); // to BP
        } else if (state.phase === 'BP') {
          await delay(1000);
          for (let i = 0; i < 5; i++) {
            const attacker = state.opponent.monsterZone[i];
            if (attacker && attacker.position === 'attack' && !attacker.hasAttacked) {
              // Find target
              const targets = state.player.monsterZone.map((m, idx) => m ? { m, idx } : null).filter(t => t !== null) as {m: GameCard, idx: number}[];
              if (targets.length === 0) {
                const action: Extract<Action, { type: 'DECLARE_ATTACK' }> = { type: 'DECLARE_ATTACK', attackerIndex: i, targetIndex: null };
                if (maybePromptPlayerResponse(action)) return;
                dispatch(action);
                await delay(1000);
              } else {
                // Attack weakest
                targets.sort((a, b) => {
                  const statA = a.m.position === 'attack' ? a.m.atk! : a.m.def!;
                  const statB = b.m.position === 'attack' ? b.m.atk! : b.m.def!;
                  return statA - statB;
                });
                const target = targets[0];
                const targetStat = target.m.position === 'attack' ? target.m.atk! : target.m.def!;
                if (attacker.atk! >= targetStat) {
                  const action: Extract<Action, { type: 'DECLARE_ATTACK' }> = { type: 'DECLARE_ATTACK', attackerIndex: i, targetIndex: target.idx };
                  if (maybePromptPlayerResponse(action)) return;
                  dispatch(action);
                  await delay(1000);
                }
              }
            }
          }
          dispatch({ type: 'NEXT_PHASE' }); // to M2
        } else if (state.phase === 'M2') {
          await delay(500);
          dispatch({ type: 'NEXT_PHASE' }); // to EP
        } else if (state.phase === 'EP') {
          await delay(500);
          dispatch({ type: 'NEXT_PHASE' }); // to Player DP
        }
      };
      runAI();
    }
  }, [state.turn, state.phase, state.winner, uiState.type, aiResumeTick, showCompetitionIntro, gameMode, currentCompetitionOpponent]);

  // Player Actions
  const handleDraw = () => {
    if (state.turn === 'player' && state.phase === 'DP') {
      dispatch({ type: 'DRAW_CARD', player: 'player' });
      setTimeout(() => dispatch({ type: 'NEXT_PHASE' }), 500);
    }
  };

  const handleNextPhase = () => {
    if (state.turn === 'player' && state.phase !== 'DP') {
      if (state.turnCount === 1 && state.phase === 'M1') {
        // Skip BP and M2 on turn 1
        dispatch({ type: 'NEXT_PHASE' }); // goes to BP
        dispatch({ type: 'NEXT_PHASE' }); // goes to M2
        dispatch({ type: 'NEXT_PHASE' }); // goes to EP
      } else {
        dispatch({ type: 'NEXT_PHASE' });
      }
      setUiState({ type: 'IDLE' });
    }
  };

  const handleHandCardClick = (card: GameCard) => {
    if (state.turn !== 'player' || (state.phase !== 'M1' && state.phase !== 'M2')) return;
    
    if (uiState.type === 'SELECT_DISCARD') {
      if (card.instanceId === uiState.spellCard.instanceId) {
        showNotice(t('cannotDiscardActivatingSpell'), t('invalidAction'));
        return;
      }
      setUiState({ 
        type: 'SELECT_SPELL_TARGET', 
        spellCard: uiState.spellCard, 
        discardInstanceId: card.instanceId,
        fromZone: uiState.fromZone 
      });
      showNotice(t('selectMonsterToDestroy'), t('actionRequired'));
      return;
    }

    if (uiState.type === 'SELECT_FUSION_MATERIALS') {
      const newSelected = uiState.selectedMaterials.includes(card.instanceId)
        ? uiState.selectedMaterials.filter(id => id !== card.instanceId)
        : [...uiState.selectedMaterials, card.instanceId];
        
      if (newSelected.length === (uiState.fusionMonster.fusionMaterials?.length || 0)) {
        // Validate materials
        const selectedCards = newSelected.map(id => 
          state.player.hand.find(c => c.instanceId === id) || 
          state.player.monsterZone.find(c => c?.instanceId === id)
        ).filter(Boolean) as GameCard[];

        let tempSelected = [...selectedCards];
        let isValid = true;
        for (const matName of uiState.fusionMonster.fusionMaterials || []) {
          const idx = tempSelected.findIndex(c => isMaterialMatch(c, matName));
          if (idx !== -1) {
            tempSelected.splice(idx, 1);
          } else {
            isValid = false;
            break;
          }
        }

        if (!isValid) {
          showNotice(t('fusionMaterialsInvalid'), t('invalidSelection'));
          setUiState({ ...uiState, selectedMaterials: [] });
          return;
        }

        // Check if there will be an empty zone
        const willHaveEmptyZone = state.player.monsterZone.some((m, i) => m === null || newSelected.includes(m.instanceId));
        if (!willHaveEmptyZone) {
          showNotice(t('fusionNoOpenZone'), t('noOpenMonsterZones'));
          setUiState({ ...uiState, selectedMaterials: [] });
          return;
        }

        dispatch({
          type: 'FUSION_SUMMON',
          player: 'player',
          fusionMonsterId: uiState.fusionMonster.id,
          materialInstanceIds: newSelected,
          spellInstanceId: uiState.spellInstanceId,
          fromZone: uiState.fromZone
        });
        setUiState({ type: 'IDLE' });
      } else {
        setUiState({ ...uiState, selectedMaterials: newSelected });
      }
      return;
    }

    if (uiState.type === 'SELECT_SPELL_TARGET' || uiState.type === 'SELECT_TRIBUTES') {
      return; // Ignore hand clicks while selecting targets or tributes
    }

    const availableActions = getHandCardActionAvailability(card, playerActivationContext);
    if (!availableActions.summon && !availableActions.setMonster && !availableActions.activate && !availableActions.setSpellTrap) {
      showNotice(t('noLegalActionsForCard', { cardName: getLocalizedCardText(card, language).name }), t('unavailable'));
      return;
    }

    setUiState({ type: 'SELECT_HAND_CARD', card });
  };

  const beginSpellActivation = (card: GameCard, fromZone?: number) => {
    if (!canActivateCard(card, playerActivationContext, fromZone)) {
      showNotice(t('cannotActivateNow', { cardName: getLocalizedCardText(card, language).name }), t('unavailable'));
      setUiState({ type: 'IDLE' });
      return;
    }

    if (card.id === 'tribute-to-the-doomed') {
      if (state.player.hand.length < (fromZone === undefined ? 2 : 1)) {
        showNotice(fromZone === undefined ? t('youNeedAnotherCardToDiscard') : t('noCardToDiscard'), t('actionRequired'));
        setUiState({ type: 'IDLE' });
        return;
      }

      const hasOpponentMonsters = state.opponent.monsterZone.some(m => m !== null);
      const hasPlayerMonsters = state.player.monsterZone.some(m => m !== null);
      if (!hasOpponentMonsters && !hasPlayerMonsters) {
        showNotice(t('noMonstersToDestroy'), t('noTarget'));
        setUiState({ type: 'IDLE' });
        return;
      }

      setUiState({ type: 'SELECT_DISCARD', spellCard: card, fromZone });
      showNotice(t('selectCardToDiscard'), t('actionRequired'));
      return;
    }

    if (card.id === 'monster-reborn') {
      const hasMonstersInGy = state.player.graveyard.some(c => c.type === 'Monster') || state.opponent.graveyard.some(c => c.type === 'Monster');
      if (!hasMonstersInGy) {
        showNotice(t('noMonstersInGraveyard'), t('noTarget'));
        setUiState({ type: 'IDLE' });
        return;
      }

      const hasEmptyZone = state.player.monsterZone.some(z => z === null);
      if (!hasEmptyZone) {
        showNotice(t('noOpenMonsterZones'), t('noOpenMonsterZones'));
        setUiState({ type: 'IDLE' });
        return;
      }

      setUiState({ type: 'SELECT_SPELL_TARGET', spellCard: card, fromZone });
      showNotice(t('selectMonsterFromEitherGraveyard'), t('actionRequired'));
      return;
    }

    if (card.id === 'brain-control') {
      if (state.player.lp < 800) {
        showNotice(t('need800LpForBrainControl'), t('unavailable'));
        setUiState({ type: 'IDLE' });
        return;
      }

      const hasTargetableMonster = state.opponent.monsterZone.some(m => m !== null && m.position !== 'set-monster');
      if (!hasTargetableMonster) {
        showNotice(t('noOpponentFaceUpMonsters'), t('noTarget'));
        setUiState({ type: 'IDLE' });
        return;
      }

      const hasEmptyZone = state.player.monsterZone.some(z => z === null);
      if (!hasEmptyZone) {
        showNotice(t('noOpenMonsterZones'), t('noOpenMonsterZones'));
        setUiState({ type: 'IDLE' });
        return;
      }

      setUiState({ type: 'SELECT_SPELL_TARGET', spellCard: card, fromZone });
      showNotice(t('selectOpponentMonsterControl'), t('actionRequired'));
      return;
    }

    if (card.id === 'de-spell') {
      const hasSpellTrapTarget = state.opponent.spellTrapZone.some(c => c !== null);
      if (!hasSpellTrapTarget) {
        showNotice(t('noOpponentSpellTrap'), t('noTarget'));
        setUiState({ type: 'IDLE' });
        return;
      }

      setUiState({ type: 'SELECT_SPELL_TARGET', spellCard: card, fromZone });
      showNotice(t('selectOpponentSpellTrap'), t('actionRequired'));
      return;
    }

    if (card.id === 'polymerization') {
      const possibleFusions = getPossibleFusionMonsters(state.player);
      if (possibleFusions.length === 0) {
        showNotice(t('fusionUnavailable'), t('unavailable'));
        setUiState({ type: 'IDLE' });
        return;
      }

      setUiState({ type: 'SELECT_FUSION_MONSTER', possibleFusions, spellInstanceId: card.instanceId, fromZone });
      showNotice(t('selectFusionMonsterToSummon'), t('actionRequired'));
      return;
    }

    dispatch({ type: 'ACTIVATE_SPELL', player: 'player', cardInstanceId: card.instanceId, fromZone });
    setUiState({ type: 'IDLE' });
  };

  const beginTrapActivation = (card: GameCard, fromZone: number) => {
    if (!canActivateSetCard(card, playerActivationContext)) {
      showNotice(t('cannotActivateNow', { cardName: getLocalizedCardText(card, language).name }), t('unavailable'));
      setUiState({ type: 'IDLE' });
      return;
    }

    if (card.id === 'dust-tornado') {
      const hasOpponentST = state.opponent.spellTrapZone.some(c => c !== null);
      if (!hasOpponentST) {
        showNotice(t('dustTornadoNoTarget'), t('noTarget'));
        setUiState({ type: 'IDLE' });
        return;
      }

      setUiState({ type: 'SELECT_SPELL_TARGET', spellCard: card, fromZone });
      showNotice(t('selectOpponentSpellTrapToDestroy'), t('actionRequired'));
      return;
    }

    showNotice(t('trapCannotActivateManually'), t('unavailable'));
  };

  const executeHandAction = (action: 'summon' | 'set' | 'activate') => {
    if (uiState.type !== 'SELECT_HAND_CARD') return;
    const card = uiState.card;
    const availableActions = getHandCardActionAvailability(card, playerActivationContext);
    
    if (card.type === 'Monster') {
      if ((action === 'summon' && !availableActions.summon) || (action === 'set' && !availableActions.setMonster)) {
        showNotice(
          action === 'summon'
            ? t('cannotSummonNow', { cardName: getLocalizedCardText(card, language).name })
            : t('cannotSetNow', { cardName: getLocalizedCardText(card, language).name }),
          t('unavailable'),
        );
        setUiState({ type: 'IDLE' });
        return;
      }
      if (state.normalSummonUsed) {
        showNotice(t('youAlreadyNormalSummoned'), t('unavailable'));
        setUiState({ type: 'IDLE' });
        return;
      }
      const level = card.level || 4;
      const tributesNeeded = level >= 7 ? 2 : level >= 5 ? 1 : 0;
      const position = action === 'summon' ? 'attack' : 'set-monster';
      
      if (tributesNeeded > 0) {
        const availableTributes = state.player.monsterZone.filter(m => m !== null).length;
        if (availableTributes < tributesNeeded) {
          showNotice(t('noTributesAvailable'), t('unavailable'));
          setUiState({ type: 'IDLE' });
          return;
        }
        setUiState({ type: 'SELECT_TRIBUTES', cardToSummon: card, count: tributesNeeded, selected: [], position });
      } else {
        dispatch({ type: 'SUMMON_MONSTER', player: 'player', cardInstanceId: card.instanceId, position, tributes: [] });
        setUiState({ type: 'IDLE' });
      }
    } else if (card.type === 'Spell' || card.type === 'Trap') {
      if (action === 'set') {
        if (!availableActions.setSpellTrap) {
          showNotice(t('noOpenSpellTrapZone'), t('noOpenMonsterZones'));
          setUiState({ type: 'IDLE' });
          return;
        }
        dispatch({ type: 'SET_SPELL_TRAP', player: 'player', cardInstanceId: card.instanceId });
        setUiState({ type: 'IDLE' });
      } else if (action === 'activate' && card.type === 'Spell') {
        if (!availableActions.activate) {
          showNotice(t('cannotActivateNow', { cardName: getLocalizedCardText(card, language).name }), t('unavailable'));
          setUiState({ type: 'IDLE' });
          return;
        }
        beginSpellActivation(card);
      } else {
        setUiState({ type: 'IDLE' });
      }
    }
  };

  const handlePlayerMonsterClick = (index: number) => {
    if (state.turn !== 'player') return;

    if (uiState.type === 'SELECT_SPELL_TARGET') {
      if (uiState.spellCard.id === 'monster-reborn') {
        showNotice(t('selectMonsterFromGraveyardInvalid'), t('invalidTarget'));
        return;
      }
      if (uiState.spellCard.id === 'dust-tornado' || uiState.spellCard.id === 'de-spell' || uiState.spellCard.id === 'brain-control') {
        showNotice(
          uiState.spellCard.id === 'brain-control' ? t('selectOpponentFaceUpMonsterShort') : t('selectOpponentSpellTrapShort'),
          t('invalidTarget'),
        );
        return;
      }
      const target = state.player.monsterZone[index];
      if (target) {
        dispatch({ 
          type: 'ACTIVATE_SPELL', 
          player: 'player', 
          cardInstanceId: uiState.spellCard.instanceId, 
          fromZone: uiState.fromZone,
          discardInstanceId: uiState.discardInstanceId,
          targetIndex: index,
          targetPlayer: 'player'
        });
        setUiState({ type: 'IDLE' });
      }
      return;
    }

    if (uiState.type === 'SELECT_TRIBUTES') {
      const card = state.player.monsterZone[index];
      if (!card) return;
      
      const newSelected = uiState.selected.includes(index) 
        ? uiState.selected.filter(i => i !== index)
        : [...uiState.selected, index];
        
      if (newSelected.length === uiState.count) {
        dispatch({ type: 'SUMMON_MONSTER', player: 'player', cardInstanceId: uiState.cardToSummon.instanceId, position: uiState.position, tributes: newSelected });
        setUiState({ type: 'IDLE' });
      } else {
        setUiState({ ...uiState, selected: newSelected });
      }
      return;
    }

    if (uiState.type === 'SELECT_FUSION_MATERIALS') {
      const card = state.player.monsterZone[index];
      if (!card) return;
      
      const newSelected = uiState.selectedMaterials.includes(card.instanceId)
        ? uiState.selectedMaterials.filter(id => id !== card.instanceId)
        : [...uiState.selectedMaterials, card.instanceId];
        
      if (newSelected.length === (uiState.fusionMonster.fusionMaterials?.length || 0)) {
        // Validate materials
        const selectedCards = newSelected.map(id => 
          state.player.hand.find(c => c.instanceId === id) || 
          state.player.monsterZone.find(c => c?.instanceId === id)
        ).filter(Boolean) as GameCard[];

        let tempSelected = [...selectedCards];
        let isValid = true;
        for (const matName of uiState.fusionMonster.fusionMaterials || []) {
          const idx = tempSelected.findIndex(c => isMaterialMatch(c, matName));
          if (idx !== -1) {
            tempSelected.splice(idx, 1);
          } else {
            isValid = false;
            break;
          }
        }

        if (!isValid) {
          showNotice(t('fusionMaterialsInvalid'), t('invalidSelection'));
          setUiState({ ...uiState, selectedMaterials: [] });
          return;
        }

        // Check if there will be an empty zone
        const willHaveEmptyZone = state.player.monsterZone.some((m, i) => m === null || newSelected.includes(m.instanceId));
        if (!willHaveEmptyZone) {
          showNotice(t('fusionNoOpenZone'), t('noOpenMonsterZones'));
          setUiState({ ...uiState, selectedMaterials: [] });
          return;
        }

        dispatch({
          type: 'FUSION_SUMMON',
          player: 'player',
          fusionMonsterId: uiState.fusionMonster.id,
          materialInstanceIds: newSelected,
          spellInstanceId: uiState.spellInstanceId,
          fromZone: uiState.fromZone
        });
        setUiState({ type: 'IDLE' });
      } else {
        setUiState({ ...uiState, selectedMaterials: newSelected });
      }
      return;
    }

    const card = state.player.monsterZone[index];
    if (!card) return;

    if (state.phase === 'M1' || state.phase === 'M2') {
      if (!card.justSummoned && !card.changedPosition && !card.hasAttacked) {
        dispatch({ type: 'CHANGE_POSITION', player: 'player', zoneIndex: index });
      }
    }
  };

  const handleMonsterActionClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (state.turn !== 'player' || state.phase !== 'BP') return;
    
    if (uiState.type === 'SELECT_ATTACK_TARGET' && uiState.attackerIndex === index) {
      setUiState({ type: 'IDLE' });
      return;
    }

    const oppHasMonsters = state.opponent.monsterZone.some(m => m !== null);
    if (!oppHasMonsters) {
      dispatch({ type: 'DECLARE_ATTACK', attackerIndex: index, targetIndex: null });
      setUiState({ type: 'IDLE' });
    } else {
      setUiState({ type: 'SELECT_ATTACK_TARGET', attackerIndex: index });
      showNotice(t('selectOpponentMonsterToAttack'), t('actionRequired'));
    }
  };

  const handleSpellTrapActionClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (state.turn !== 'player' || (state.phase !== 'M1' && state.phase !== 'M2')) return;
    
    const card = state.player.spellTrapZone[index];
    if (!card) return;

    if (card.type === 'Spell') {
      beginSpellActivation(card, index);
    } else if (card.type === 'Trap') {
      beginTrapActivation(card, index);
    }
  };

  const handleOpponentMonsterClick = (index: number) => {
    if (state.turn !== 'player') return;
    
    if (uiState.type === 'SELECT_SPELL_TARGET') {
      if (uiState.spellCard.id === 'monster-reborn') {
        showNotice(t('selectMonsterFromGraveyardInvalid'), t('invalidTarget'));
        return;
      }
      if (uiState.spellCard.id === 'dust-tornado' || uiState.spellCard.id === 'de-spell') {
        showNotice(t('selectOpponentSpellTrapShort'), t('invalidTarget'));
        return;
      }
      const target = state.opponent.monsterZone[index];
      if (uiState.spellCard.id === 'brain-control' && target && (target.position === 'set-monster' || target.isFusion)) {
        showNotice(t('brainControlTargetRestriction'), t('invalidTarget'));
        return;
      }
      if (target) {
        dispatch({ 
          type: 'ACTIVATE_SPELL', 
          player: 'player', 
          cardInstanceId: uiState.spellCard.instanceId, 
          fromZone: uiState.fromZone,
          discardInstanceId: uiState.discardInstanceId,
          targetIndex: index,
          targetPlayer: 'opponent'
        });
        setUiState({ type: 'IDLE' });
      }
      return;
    }

    if (state.phase !== 'BP') return;
    
    if (uiState.type === 'SELECT_ATTACK_TARGET') {
      const target = state.opponent.monsterZone[index];
      if (target) {
        dispatch({ type: 'DECLARE_ATTACK', attackerIndex: uiState.attackerIndex, targetIndex: index });
        setUiState({ type: 'IDLE' });
      }
    }
  };

  const handleOpponentSpellTrapClick = (index: number) => {
    if (state.turn !== 'player') return;

    if (uiState.type === 'SELECT_SPELL_TARGET' && (uiState.spellCard.id === 'dust-tornado' || uiState.spellCard.id === 'de-spell')) {
      const target = state.opponent.spellTrapZone[index];
      if (target) {
        if (uiState.spellCard.id === 'dust-tornado') {
          dispatch({
            type: 'ACTIVATE_TRAP',
            player: 'player',
            cardInstanceId: uiState.spellCard.instanceId,
            fromZone: uiState.fromZone,
            targetIndex: index,
            targetPlayer: 'opponent'
          });
        } else {
          dispatch({
            type: 'ACTIVATE_SPELL',
            player: 'player',
            cardInstanceId: uiState.spellCard.instanceId,
            fromZone: uiState.fromZone,
            targetIndex: index,
            targetPlayer: 'opponent'
          });
        }
        setUiState({ type: 'IDLE' });
      }
    }
  };

  const handlePlayerGyClick = () => {
    if (state.turn !== 'player') return;
    if (uiState.type === 'SELECT_SPELL_TARGET') {
      if (uiState.spellCard.id !== 'monster-reborn') {
        showNotice(t('invalidTargetMessage'), t('invalidTarget'));
        return;
      }
      openMonsterRebornZoneSelection('player', uiState.spellCard, uiState.fromZone);
    }
  };

  const handleOpponentGyClick = () => {
    if (state.turn !== 'player') return;
    if (uiState.type === 'SELECT_SPELL_TARGET') {
      if (uiState.spellCard.id !== 'monster-reborn') {
        showNotice(t('invalidTargetMessage'), t('invalidTarget'));
        return;
      }
      openMonsterRebornZoneSelection('opponent', uiState.spellCard, uiState.fromZone);
    }
  };

  const handleZoneCardSelection = (sourceIndex: number) => {
    if (uiState.type !== 'SELECT_ZONE_CARD') return;

    if (uiState.purpose.type === 'MONSTER_REBORN') {
      dispatch({
        type: 'ACTIVATE_SPELL',
        player: 'player',
        cardInstanceId: uiState.purpose.spellCard.instanceId,
        fromZone: uiState.purpose.fromZone,
        targetIndex: sourceIndex,
        targetPlayer: uiState.purpose.targetPlayer,
      });
      setUiState({ type: 'IDLE' });
    }
  };

  if (bootState === 'error') {
    return (
      <div className="h-dvh md:h-screen box-border bg-black flex items-center justify-center text-white font-mono uppercase tracking-widest pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:p-0">
        <div className="border border-zinc-800 bg-zinc-950 px-6 py-4 text-sm text-zinc-400">
          Failed to load game content.
        </div>
      </div>
    );
  }

  const showMobileShell = isMobile && view !== 'game' && view !== 'sign-in';

  return (
    <>
      {view === 'start' && !showMobileShell && (
        <div className="h-dvh md:h-screen box-border bg-black flex flex-col items-center justify-center text-white font-sans relative overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:p-0">
          <div className="absolute inset-x-6 bottom-6 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent md:inset-x-12 md:bottom-10"></div>
          
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: reduced ? 0 : 0.05,
                  delayChildren: reduced ? 0 : 0.04,
                },
              },
            }}
            className="z-10 flex w-full max-w-4xl flex-col items-center px-6"
          >
            <motion.div
              variants={{
                hidden: { opacity: 0, y: reduced ? 0 : 10 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={getSharedTransition(reduced, 'normal')}
              className="flex flex-col items-center"
            >
              <div className="theme-eyebrow text-center text-sm sm:text-base">
                {t('appTitle')}
              </div>
              <h1 className="theme-title mt-5 text-center text-3xl sm:text-5xl uppercase tracking-[0.32em]">
                {t('readyForDuel')}
              </h1>
              <div className="theme-subtle mt-4 text-[10px] font-mono uppercase tracking-[0.24em]">
                {userProfile ? `${t('signedInAs')} ${userProfile.displayName}` : t('guestMode')}
              </div>
            </motion.div>
            <motion.p
              variants={{
                hidden: { opacity: 0, y: reduced ? 0 : 8 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={getSharedTransition(reduced, 'fast')}
              className="mb-10"
            />
            
            <motion.div
              variants={{
                hidden: { opacity: 0, y: reduced ? 0 : 10 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={getSharedTransition(reduced, 'normal')}
              className="flex w-full max-w-3xl flex-col gap-4"
            >
              <motion.button 
                onClick={openCpuModeSelection} 
                whileTap={{ scale: reduced ? 1 : 0.99 }}
                className="theme-button-subtle px-6 py-4 font-mono text-sm uppercase tracking-[0.25em]"
              >
                {t('cpuMode')}
              </motion.button>

              <motion.button 
                onClick={startCompetitionMode} 
                whileTap={{ scale: reduced ? 1 : 0.99 }}
                className="theme-button-subtle px-6 py-4 font-mono text-sm uppercase tracking-[0.25em]"
              >
                {t('competitionMode')}
              </motion.button>
              
              <div className="theme-divider my-3 h-px w-full"></div>
              
              <motion.button 
                onClick={() => setView('deck-builder')} 
                whileTap={{ scale: reduced ? 1 : 0.99 }}
                className="theme-button-subtle px-6 py-4 font-mono text-sm uppercase tracking-[0.25em]"
              >
                {t('deckBuilder')}
              </motion.button>

              <motion.button 
                onClick={() => setView('how-to-play')} 
                whileTap={{ scale: reduced ? 1 : 0.99 }}
                className="theme-button-subtle px-6 py-4 font-mono text-sm uppercase tracking-[0.25em]"
              >
                {t('howToPlay')}
              </motion.button>

              <motion.button 
                onClick={() => setView('history')} 
                whileTap={{ scale: reduced ? 1 : 0.99 }}
                className="theme-button-subtle px-6 py-4 font-mono text-sm uppercase tracking-[0.25em]"
              >
                {t('gameHistory')}
              </motion.button>

              <motion.button 
                onClick={() => void handleHomeAuthAction()} 
                whileTap={{ scale: reduced ? 1 : 0.99 }}
                className="theme-button-subtle px-6 py-4 font-mono text-sm uppercase tracking-[0.25em]"
              >
                {userProfile ? t('logout') : t('signIn')}
              </motion.button>
            </motion.div>
          </motion.div>

          <AnimatePresence>
            {!authCheckComplete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={getSharedTransition(reduced, 'fast')}
                className="absolute inset-0 z-30 bg-black/90 flex items-center justify-center px-4"
              >
                <div className="theme-panel px-6 py-4 text-sm font-mono uppercase tracking-widest theme-muted">
                  {t('loadingAccount')}
                </div>
              </motion.div>
            )}
            {!userProfile && showAuthPrompt && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={getSharedTransition(reduced, 'fast')}
                className="absolute inset-0 z-30 bg-black/90 flex items-center justify-center px-4"
              >
                <motion.div
                  initial={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -8, scale: reduced ? 1 : 0.99 }}
                  transition={getSharedTransition(reduced, 'normal')}
                  className="w-full max-w-lg"
                >
                  <SignInPage
                    mode="modal"
                    onBack={dismissAuthPrompt}
                    onContinueAsGuest={dismissAuthPrompt}
                    onSuccess={() => {
                      setAuthPromptDismissed(true);
                      setView('start');
                    }}
                  />
                </motion.div>
              </motion.div>
            )}
            {showCompetitionLobby && competitionResumeOpponent && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={getSharedTransition(reduced, 'fast')}
                className="absolute inset-0 z-20 bg-black/85 flex items-center justify-center px-4"
                onClick={() => setShowCompetitionLobby(false)}
              >
                <motion.div
                  initial={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -8, scale: reduced ? 1 : 0.99 }}
                  transition={getSharedTransition(reduced, 'normal')}
                  className="theme-panel w-full max-w-xl p-6 flex flex-col gap-5"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="text-center">
                    <div className="theme-eyebrow text-[10px]">
                      {t('competitionMode')}
                    </div>
                    <h2 className="theme-title mt-3 text-2xl uppercase">
                      {t('playHomeLadder')}
                    </h2>
                    <p className="theme-subtle mt-2 text-xs font-mono uppercase tracking-[0.18em]">
                      {t('currentStage')}: {competitionResumeOpponent.stage} / {competitionResumeOpponent.totalStages}
                    </p>
                  </div>
                  <div className="theme-elevated px-4 py-4">
                    <div className="theme-eyebrow text-[10px]">
                      {t('nextOpponent')}
                    </div>
                    <div className="theme-title mt-2 text-lg uppercase tracking-[0.15em]">
                      {competitionResumeOpponent.name}
                    </div>
                    <div className="theme-subtle mt-3 text-xs font-mono uppercase tracking-[0.2em]">
                      {t('cleared')}: {Math.max(0, competitionResumeOpponent.stage - 1)} / {competitionResumeOpponent.totalStages}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {competitionResumeOpponent.signatureCardIds.map((cardId) => (
                      <div key={cardId} className="theme-elevated px-3 py-3 text-center">
                        <div className="theme-eyebrow text-[9px]">{t('signature')}</div>
                        <div className="theme-title mt-2 text-[11px] uppercase tracking-[0.12em]">
                          {buildCompetitionPreviewCard(cardId).name}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3">
                    <button
                      onClick={() => void startCompetitionDuel(competitionResumeStageIndex)}
                      className="theme-button px-4 py-3 font-mono text-sm uppercase tracking-widest"
                    >
                      {competitionResumeStageIndex > 0 ? t('resumeLadder') : t('beginLadder')}
                    </button>
                    {competitionResumeStageIndex > 0 && (
                      <button
                        onClick={() => {
                          void clearCompetitionProgress().then(() => {
                            setCompetitionResumeStageIndex(0);
                            void startCompetitionDuel(0);
                          });
                        }}
                        className="theme-button-subtle px-4 py-3 font-mono text-sm uppercase tracking-widest"
                      >
                        {t('restartFromStage1')}
                      </button>
                    )}
                    <button
                      onClick={() => setShowCompetitionLobby(false)}
                      className="theme-subtle text-xs font-mono uppercase tracking-widest"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {showMobileShell && (
        <div className="theme-screen flex h-dvh box-border flex-col overflow-hidden pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          <MobileAppBar
            title={t('appTitle')}
            rightSlot={(
              <button
                type="button"
                onClick={() => {
                  setShowMobileAccountSheet(true);
                  setMobileSheetExpanded(false);
                }}
                className="flex max-w-[144px] items-center gap-1.5 text-right text-[9px] font-mono uppercase tracking-[0.14em] text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text-primary)]"
              >
                <UserRound size={11} />
                {userProfile ? userProfile.displayName : t('guestMode')}
              </button>
            )}
          />

          <div className="min-h-0 flex-1 overflow-hidden">
            {mobileTab === 'play' && view === 'start' ? renderMobilePlayHome() : null}
            {mobileTab === 'deck-builder' && view === 'deck-builder' ? (
              <Suspense fallback={renderLazyScreenFallback(t('deckBuilder'), true)}>
                <DeckBuilder onBack={() => handleMobileTabChange('play')} announce={showAnnouncement} embeddedInShell />
              </Suspense>
            ) : null}
            {mobileTab === 'rules' && view === 'how-to-play' ? (
              <Suspense fallback={renderLazyScreenFallback(t('howToPlay'), true)}>
                <HowToPlay onBack={() => handleMobileTabChange('play')} embeddedInShell />
              </Suspense>
            ) : null}
          </div>

          <AnimatePresence>
            {!authCheckComplete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={getSharedTransition(reduced, 'fast')}
                className="absolute inset-0 z-40 bg-black/90 flex items-center justify-center px-4"
              >
                <div className="theme-panel px-6 py-4 text-sm font-mono uppercase tracking-widest theme-muted">
                  {t('loadingAccount')}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <MobileBottomSheet
            open={showMobileAccountSheet}
            onClose={() => setShowMobileAccountSheet(false)}
            title={t('account')}
            expandable
            expanded={mobileSheetExpanded}
            onToggleExpanded={() => setMobileSheetExpanded((previous) => !previous)}
            compactHeightClassName="max-h-[42vh]"
            maxHeightClassName="max-h-[72vh]"
          >
            <div className="space-y-2.5">
              <div className="theme-elevated rounded-[10px] px-3 py-3">
                <div className="theme-eyebrow text-[9px]">
                  {userProfile ? t('signedInAs') : t('guestMode')}
                </div>
                <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.08em] leading-4.5 text-[var(--app-text-secondary)]">
                  {userProfile?.email ?? userProfile?.displayName ?? t('guestMode')}
                </div>
              </div>
              <div className="grid gap-2.5">
                <div className="block">
                  <span className="theme-eyebrow text-[9px]">{t('language')}</span>
                  <div className="theme-input mt-1.5 grid w-full grid-cols-[28px_1fr_28px] items-center rounded-[8px] px-1">
                    <button
                      type="button"
                      onClick={() => setLanguage(cyclePreferenceOption(languageOptions, language, 'previous') as typeof language)}
                      className="theme-button-subtle flex h-6 w-6 items-center justify-center p-0"
                      aria-label={t('language')}
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <div className="truncate px-2 text-center font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--app-text-primary)]">
                      {languageOptions.find((option) => option.value === language)?.label ?? language}
                    </div>
                    <button
                      type="button"
                      onClick={() => setLanguage(cyclePreferenceOption(languageOptions, language, 'next') as typeof language)}
                      className="theme-button-subtle flex h-6 w-6 items-center justify-center p-0"
                      aria-label={t('language')}
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
                <div className="block">
                  <span className="theme-eyebrow text-[9px]">{t('theme')}</span>
                  <div className="theme-input mt-1.5 grid w-full grid-cols-[28px_1fr_28px] items-center rounded-[8px] px-1">
                    <button
                      type="button"
                      onClick={() => setTheme(cyclePreferenceOption(themeOptions, theme, 'previous') as typeof theme)}
                      className="theme-button-subtle flex h-6 w-6 items-center justify-center p-0"
                      aria-label={t('theme')}
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <div className="truncate px-2 text-center font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--app-text-primary)]">
                      {themeOptions.find((option) => option.value === theme)?.label ?? theme}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTheme(cyclePreferenceOption(themeOptions, theme, 'next') as typeof theme)}
                      className="theme-button-subtle flex h-6 w-6 items-center justify-center p-0"
                      aria-label={t('theme')}
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
              {userProfile ? (
                <div className="grid gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileAccountSheet(false);
                      setView('sign-in');
                    }}
                    className="theme-button-subtle w-full rounded-[6px] px-3 py-1.5 text-[8px] font-mono uppercase tracking-[0.12em]"
                  >
                    {t('switchAccount')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleHomeAuthAction()}
                    className="theme-button w-full rounded-[6px] px-3 py-1.5 text-[8px] font-mono uppercase tracking-[0.12em]"
                  >
                    {t('signOut')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileAccountSheet(false);
                    setView('sign-in');
                  }}
                  className="theme-button w-full rounded-[6px] px-3 py-1.5 text-[8px] font-mono uppercase tracking-[0.12em]"
                >
                  {t('signIn')}
                </button>
              )}
            </div>
          </MobileBottomSheet>

          <MobileBottomSheet
            open={pendingCpuModeSelection}
            onClose={() => setPendingCpuModeSelection(false)}
            title={t('cpuMode')}
            compactHeightClassName="max-h-[34vh]"
            maxHeightClassName="max-h-[34vh]"
          >
            <div className="grid gap-3 pb-2">
              <button
                type="button"
                onClick={startRandomGame}
                className="theme-elevated rounded-[10px] px-3.5 py-3 text-left"
              >
                <div className="theme-eyebrow text-[10px]">{t('playHomeQuickDuel')}</div>
                <div className="theme-title mt-1.5 text-[13px] uppercase tracking-[0.08em]">{t('randomDeck')}</div>
              </button>
              <button
                type="button"
                onClick={() => void startCustomGame()}
                className="theme-elevated rounded-[10px] px-3.5 py-3 text-left"
              >
                <div className="theme-eyebrow text-[10px]">{t('playHomePrimaryDeck')}</div>
                <div className="theme-title mt-1.5 text-[13px] uppercase tracking-[0.08em]">{t('customDeck')}</div>
              </button>
            </div>
          </MobileBottomSheet>

          <MobileBottomSheet
            open={showCompetitionLobby}
            onClose={() => setShowCompetitionLobby(false)}
            title={t('competition')}
            expandable
            expanded={mobileSheetExpanded}
            onToggleExpanded={() => setMobileSheetExpanded((previous) => !previous)}
            compactHeightClassName="max-h-[46vh]"
            maxHeightClassName="max-h-[78vh]"
          >
            {competitionResumeOpponent ? (
              <div className="space-y-4 pb-2">
                <div className="theme-elevated rounded-[10px] px-3.5 py-3.5">
                  <div className="theme-eyebrow text-[10px]">{t('currentStage')}</div>
                  <div className="theme-title mt-2 text-[15px] uppercase tracking-[0.1em]">
                    {competitionResumeOpponent.stage} / {competitionResumeOpponent.totalStages}
                  </div>
                  <div className="theme-muted mt-1.5 text-[12px] leading-5">
                    {t('nextOpponent')}: {competitionResumeOpponent.name}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {competitionResumeOpponent.signatureCardIds.map((cardId) => (
                    <div key={cardId} className="theme-elevated rounded-[10px] px-2.5 py-2.5 text-center">
                      <div className="theme-eyebrow text-[9px]">{t('signature')}</div>
                      <div className="theme-title mt-1.5 text-[10px] uppercase tracking-[0.08em]">
                        {buildCompetitionPreviewCard(cardId).name}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => void startCompetitionDuel(competitionResumeStageIndex)}
                    className="theme-button w-full rounded-[8px] px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em]"
                  >
                    {competitionResumeStageIndex > 0 ? t('resumeLadder') : t('beginLadder')}
                  </button>
                  {competitionResumeStageIndex > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        void clearCompetitionProgress().then(() => {
                          setCompetitionResumeStageIndex(0);
                          void startCompetitionDuel(0);
                        });
                      }}
                      className="w-full rounded-[8px] border border-zinc-800 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-400"
                    >
                      {t('restartFromStage1')}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </MobileBottomSheet>

          <MobileBottomSheet
            open={Boolean(selectedHistoryEntry)}
            onClose={() => setSelectedHistoryEntryId(null)}
            title={t('duelHistory')}
            expandable
            expanded={mobileHistorySheetExpanded}
            onToggleExpanded={() => setMobileHistorySheetExpanded((previous) => !previous)}
            compactHeightClassName="max-h-[58vh]"
            maxHeightClassName="max-h-[84vh]"
          >
            {selectedHistoryEntry ? (
              <div className="space-y-3 pb-2">
                <div>
                  <div className="theme-title text-[12px] uppercase tracking-[0.06em]">
                    {selectedHistoryEntry.opponentLabel}
                  </div>
                  <div className="theme-muted mt-1 text-[10px] leading-4.5">
                    {selectedHistoryEntry.summary}
                  </div>
                </div>
                <DuelHistoryDetailContent entry={selectedHistoryEntry} compact />
              </div>
            ) : null}
          </MobileBottomSheet>

          <MobileTabBar activeTab={mobileTab} onTabChange={handleMobileTabChange} />
        </div>
      )}

      {view === 'deck-builder' && !showMobileShell && (
        <Suspense fallback={renderLazyScreenFallback(t('deckBuilder'))}>
          <DeckBuilder onBack={() => setView('start')} announce={showAnnouncement} />
        </Suspense>
      )}
      {view === 'how-to-play' && !showMobileShell && (
        <Suspense fallback={renderLazyScreenFallback(t('howToPlay'))}>
          <HowToPlay onBack={() => setView('start')} />
        </Suspense>
      )}
      {view === 'sign-in' && (
        <Suspense fallback={renderLazyScreenFallback(t('signIn'))}>
          <SignInPage
            onBack={() => setView('start')}
            onSuccess={() => setView('start')}
          />
        </Suspense>
      )}
      {view === 'history' && !showMobileShell && (
        <Suspense fallback={renderLazyScreenFallback(t('gameHistory'))}>
          <GameHistoryPage onBack={() => setView('start')} />
        </Suspense>
      )}
      <AnimatePresence>
        {view !== 'game' && activeAnnouncement && (
          <AnnouncementOverlay
            announcement={activeAnnouncement}
            reduced={reduced}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none px-4"
          />
        )}
      </AnimatePresence>
      {view === 'game' && (
        <div className="h-dvh md:h-screen box-border overflow-hidden bg-black text-white font-sans flex flex-col md:flex-row pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+68px)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:p-0">
          {/* Main Game Area */}
          <div className="flex-grow flex flex-col relative overflow-hidden min-h-0">
            <AnimatePresence>
              {activeAnnouncement && (
                <AnnouncementOverlay
                  announcement={activeAnnouncement}
                  reduced={reduced}
                  className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none px-4"
                />
              )}
            </AnimatePresence>

            
            {/* Top Bar: Phase & Turn Info */}
            {gameMode === 'competition' && currentCompetitionOpponent ? (
              <div className="h-14 md:h-12 border-b border-zinc-800 grid grid-cols-[auto_1fr_auto] md:grid-cols-[1fr_auto_1fr] items-center px-3 md:px-6 gap-3 bg-black z-10 shrink-0">
                <div className="flex items-center gap-2 md:gap-4 justify-self-start text-[10px] md:text-xs font-mono text-zinc-500 uppercase tracking-widest min-w-0">
                  <motion.span
                    key={`${state.turn}-${state.turnCount}`}
                    initial={{ opacity: 0, x: reduced ? 0 : -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={getSharedTransition(reduced, 'fast')}
                  >
                    {state.turn === 'player' ? 'P1 Turn' : `${opponentShortLabel} Turn`}
                  </motion.span>
                  <button 
                    onClick={handleMenuClick}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors border border-zinc-800 px-2 py-1 rounded hover:border-zinc-600 shrink-0"
                  >
                    <Settings size={12} /> Menu
                  </button>
                </div>
                <div className="justify-self-center text-[9px] md:text-[10px] font-mono uppercase tracking-[0.22em] md:tracking-[0.3em] text-zinc-700 whitespace-nowrap truncate max-w-full text-center px-1">
                  {t('stageOfTotal', {
                    stage: currentCompetitionOpponent.stage,
                    total: currentCompetitionOpponent.totalStages,
                  })}: {currentCompetitionOpponent.name}
                </div>
                {renderPhaseTracker('flex gap-2 md:gap-3 text-[10px] md:text-xs font-mono justify-self-end shrink-0')}
              </div>
            ) : cpuModeHeading ? (
              <div className="h-14 md:h-12 border-b border-zinc-800 grid grid-cols-[auto_1fr_auto] md:grid-cols-[1fr_auto_1fr] items-center px-3 md:px-6 gap-3 bg-black z-10 shrink-0">
                <div className="flex items-center gap-2 md:gap-4 justify-self-start text-[10px] md:text-xs font-mono text-zinc-500 uppercase tracking-widest min-w-0">
                  <motion.span
                    key={`${state.turn}-${state.turnCount}`}
                    initial={{ opacity: 0, x: reduced ? 0 : -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={getSharedTransition(reduced, 'fast')}
                  >
                    {state.turn === 'player' ? 'P1 Turn' : `${opponentShortLabel} Turn`}
                  </motion.span>
                  <button 
                    onClick={handleMenuClick}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors border border-zinc-800 px-2 py-1 rounded hover:border-zinc-600 shrink-0"
                  >
                    <Settings size={12} /> Menu
                  </button>
                </div>
                <div className="justify-self-center text-[9px] md:text-[10px] font-mono uppercase tracking-[0.22em] md:tracking-[0.3em] text-zinc-700 whitespace-nowrap truncate max-w-full text-center px-1">
                  {cpuModeHeading}
                </div>
                {renderPhaseTracker('flex gap-2 md:gap-3 text-[10px] md:text-xs font-mono justify-self-end shrink-0')}
              </div>
            ) : (
              <div className="h-14 md:h-12 border-b border-zinc-800 flex items-center justify-between px-3 md:px-6 bg-black z-10 shrink-0 gap-3">
                <div className="text-[10px] md:text-xs font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2 md:gap-4 min-w-0">
                  <motion.span
                    key={`${state.turn}-${state.turnCount}`}
                    initial={{ opacity: 0, x: reduced ? 0 : -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={getSharedTransition(reduced, 'fast')}
                  >
                    {state.turn === 'player' ? 'P1 Turn' : `${opponentShortLabel} Turn`}
                  </motion.span>
                  <button 
                    onClick={handleMenuClick}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors border border-zinc-800 px-2 py-1 rounded hover:border-zinc-600 shrink-0"
                  >
                    <Settings size={12} /> Menu
                  </button>
                </div>
                {renderPhaseTracker('flex gap-2 md:gap-3 text-[10px] md:text-xs font-mono shrink-0')}
              </div>
            )}

          {/* Next Phase Button (Center Right) */}
          <button 
            onClick={handleNextPhase}
            disabled={state.turn !== 'player' || state.phase === 'DP'}
            className="hidden md:flex absolute right-4 top-[calc(50%+24px)] -translate-y-1/2 z-20 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors items-center justify-center p-2 border border-zinc-800 rounded bg-black hover:border-zinc-600 shadow-lg"
            title="Next Phase"
          >
            <ArrowRight size={20} />
          </button>

          {/* Opponent Area */}
          <div className="hidden md:flex flex-1 p-2 sm:p-4 border-b border-zinc-800 bg-black">
            {/* Left Column: LP */}
            <div className="w-16 sm:w-24 flex flex-col justify-start shrink-0">
              <div className="px-2 py-1 sm:px-4 sm:py-2 border border-zinc-800 rounded bg-black">
                <div className="text-zinc-500 text-[8px] sm:text-[10px] font-mono uppercase tracking-widest">{opponentLabel} LP</div>
                <motion.div
                  key={`desktop-opp-lp-${state.opponent.lp}`}
                  initial={{ opacity: 0.45, y: reduced ? 0 : -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={getSharedTransition(reduced, 'fast')}
                  className="text-lg sm:text-2xl font-mono text-white tracking-tighter"
                >
                  {state.opponent.lp}
                </motion.div>
              </div>
            </div>

            {/* Center Column: Hand and Field */}
            <div className="flex-1 flex flex-col justify-between min-w-0 px-2 sm:px-4">
              {/* Opponent Hand */}
              <div className="flex justify-center mb-auto min-w-0 overflow-hidden pt-2 pb-2">
                <div className="flex justify-center -space-x-8 sm:-space-x-4 w-max min-w-full">
                  {state.opponent.hand.map((c, i) => (
                    <div key={c.instanceId} className="shrink-0">
                      <CardView card={c} isHidden className="transform scale-75 sm:scale-100" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Opponent Field */}
              <div className="mt-4">
                <div className="flex justify-center gap-2 sm:gap-4 mb-2">
                  {state.opponent.monsterZone.map((card, i) => (
                    <CardView 
                      key={i} 
                      card={card} 
                      onClick={() => handleOpponentMonsterClick(i)}
                      isSelectable={
                        (uiState.type === 'SELECT_ATTACK_TARGET' && card !== null) ||
                        (uiState.type === 'SELECT_SPELL_TARGET' && uiState.spellCard.id === 'tribute-to-the-doomed' && card !== null) ||
                        (uiState.type === 'SELECT_SPELL_TARGET' && uiState.spellCard.id === 'brain-control' && card !== null && card.position !== 'set-monster' && !card.isFusion)
                      }
                      onMouseEnter={() => card && card.position !== 'set-monster' && setShowCardDetail(card)}
                      onMouseLeave={() => setShowCardDetail(null)}
                    />
                  ))}
                </div>
                <div className="flex justify-center gap-2 sm:gap-4">
                  {state.opponent.spellTrapZone.map((card, i) => (
                    <CardView 
                      key={i} 
                      card={card} 
                      onClick={() => handleOpponentSpellTrapClick(i)}
                      isSelectable={
                        uiState.type === 'SELECT_SPELL_TARGET' &&
                        (uiState.spellCard.id === 'dust-tornado' || uiState.spellCard.id === 'de-spell') &&
                        card !== null
                      }
                      onMouseEnter={() => card && card.position !== 'set-spell' && setShowCardDetail(card)}
                      onMouseLeave={() => setShowCardDetail(null)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Deck/GY */}
            <div className="w-12 sm:w-16 flex flex-col items-center justify-start gap-2 sm:gap-4 shrink-0">
              <div 
                className={`w-12 h-16 sm:w-16 sm:h-24 rounded border border-zinc-800 bg-zinc-950 flex items-center justify-center overflow-hidden ${uiState.type === 'SELECT_SPELL_TARGET' && uiState.spellCard.id === 'monster-reborn' ? 'cursor-pointer ring-2 ring-blue-500' : ''}`}
                onClick={handleOpponentGyClick}
              >
                {state.opponent.graveyard.length > 0 ? (
                  <CardView 
                    card={state.opponent.graveyard[state.opponent.graveyard.length - 1]} 
                    className="border-none w-full h-full" 
                    onMouseEnter={() => setShowCardDetail(state.opponent.graveyard[state.opponent.graveyard.length - 1])}
                    onMouseLeave={() => setShowCardDetail(null)}
                  />
                ) : (
                  <div className="text-zinc-700 font-mono text-[8px] sm:text-[10px] tracking-widest">GY</div>
                )}
              </div>
              <div className="w-12 h-16 sm:w-16 sm:h-24 rounded border border-zinc-800 bg-zinc-900 flex items-center justify-center" title="Main Deck">
                <div className="text-zinc-600 font-mono text-[8px] sm:text-[10px] tracking-widest text-center">DECK<br/>({state.opponent.deck.length})</div>
              </div>
              <div className="w-12 h-16 sm:w-16 sm:h-24 rounded border border-zinc-800 bg-zinc-900 flex items-center justify-center" title="Extra Deck">
                <div className="text-zinc-600 font-mono text-[8px] sm:text-[10px] tracking-widest text-center">EXTRA<br/>({state.opponent.extraDeck.length})</div>
              </div>
            </div>
          </div>

          {/* Player Area */}
          <div className="hidden md:flex flex-1 p-2 sm:p-4 bg-black">
            {/* Left Column: LP */}
            <div className="w-16 sm:w-24 flex flex-col justify-end shrink-0">
              <div className="px-2 py-1 sm:px-4 sm:py-2 border border-zinc-800 rounded bg-black">
                <div className="text-zinc-500 text-[8px] sm:text-[10px] font-mono uppercase tracking-widest">P1 LP</div>
                <motion.div
                  key={`desktop-player-lp-${state.player.lp}`}
                  initial={{ opacity: 0.45, y: reduced ? 0 : -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={getSharedTransition(reduced, 'fast')}
                  className="text-lg sm:text-2xl font-mono text-white tracking-tighter"
                >
                  {state.player.lp}
                </motion.div>
              </div>
            </div>

            {/* Center Column: Field and Hand */}
            <div className="flex-1 flex flex-col justify-between min-w-0 px-2 sm:px-4">
              {/* Player Field */}
              <div className="mb-4">
                <div className="flex justify-center gap-2 sm:gap-4 mb-2">
                  {state.player.spellTrapZone.map((card, i) => (
                    <CardView 
                      key={i} 
                      card={card} 
                      action={
                        state.turn === 'player' &&
                        (state.phase === 'M1' || state.phase === 'M2') &&
                        card !== null &&
                        ((card.type === 'Spell' && canActivateCard(card, playerActivationContext, i)) ||
                          (card.type === 'Trap' && canActivateSetCard(card, playerActivationContext)))
                          ? 'activate'
                          : null
                      }
                      onActionClick={(e) => handleSpellTrapActionClick(e, i)}
                      onMouseEnter={() => card && setShowCardDetail(card)}
                      onMouseLeave={() => setShowCardDetail(null)}
                    />
                  ))}
                </div>
                <div className="flex justify-center gap-2 sm:gap-4">
                  {state.player.monsterZone.map((card, i) => (
                    <CardView 
                      key={i} 
                      card={card} 
                      onClick={() => handlePlayerMonsterClick(i)}
                      isSelectable={
                        (uiState.type === 'SELECT_TRIBUTES' && card !== null) ||
                        (uiState.type === 'SELECT_FUSION_MATERIALS' && card !== null) ||
                        (uiState.type === 'SELECT_SPELL_TARGET' && uiState.spellCard.id === 'tribute-to-the-doomed' && card !== null) ||
                        (state.phase === 'BP' && card?.position === 'attack' && !card.hasAttacked) ||
                        ((state.phase === 'M1' || state.phase === 'M2') && card !== null && !card.justSummoned && !card.changedPosition && !card.hasAttacked)
                      }
                      isSelected={
                        (uiState.type === 'SELECT_TRIBUTES' && uiState.selected.includes(i)) ||
                        (uiState.type === 'SELECT_ATTACK_TARGET' && uiState.attackerIndex === i) ||
                        (uiState.type === 'SELECT_FUSION_MATERIALS' && card !== null && uiState.selectedMaterials.includes(card.instanceId))
                      }
                      action={state.turn === 'player' && state.phase === 'BP' && card?.position === 'attack' && !card.hasAttacked ? 'attack' : null}
                      onActionClick={(e) => handleMonsterActionClick(e, i)}
                      onMouseEnter={() => card && setShowCardDetail(card)}
                      onMouseLeave={() => setShowCardDetail(null)}
                    />
                  ))}
                </div>
              </div>

              {/* Player Hand */}
              <div className="flex justify-center mt-auto min-w-0 overflow-x-auto pt-6 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="flex justify-center -space-x-4 sm:-space-x-2 w-max min-w-full">
                  {state.player.hand.map((card) => (
                    <div key={card.instanceId} className="relative group shrink-0" onMouseEnter={() => setShowCardDetail(card)} onMouseLeave={() => setShowCardDetail(null)}>
                          <CardView 
                            card={card} 
                            onClick={() => handleHandCardClick(card)}
                            className="hover:-translate-y-2 sm:hover:-translate-y-3 transition-transform duration-150 z-10 hover:z-20"
                            isSelectable={state.turn === 'player' && (state.phase === 'M1' || state.phase === 'M2')}
                            isSelected={uiState.type === 'SELECT_FUSION_MATERIALS' && uiState.selectedMaterials.includes(card.instanceId)}
                          />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Deck/GY */}
            <div className="w-12 sm:w-16 flex flex-col items-center justify-end gap-2 sm:gap-4 shrink-0">
              <div 
                className={`w-12 h-16 sm:w-16 sm:h-24 rounded border border-zinc-800 bg-zinc-900 flex items-center justify-center`}
                title="Extra Deck"
              >
                <div className="font-mono text-[8px] sm:text-[10px] tracking-widest text-zinc-400 text-center">EXTRA<br/>({state.player.extraDeck.length})</div>
              </div>
              <div 
                className={`w-12 h-16 sm:w-16 sm:h-24 rounded border bg-zinc-900 flex items-center justify-center cursor-pointer transition-all ${canPlayerDraw ? 'border-white border-dashed text-white' : 'border-zinc-800 text-zinc-400'}`}
                onClick={handleDraw}
                title="Main Deck"
              >
                <div className="font-mono text-[8px] sm:text-[10px] tracking-widest text-center">DECK<br/>({state.player.deck.length})</div>
              </div>
              <div 
                className={`w-12 h-16 sm:w-16 sm:h-24 rounded border border-zinc-800 bg-zinc-950 flex items-center justify-center overflow-hidden ${uiState.type === 'SELECT_SPELL_TARGET' && uiState.spellCard.id === 'monster-reborn' ? 'cursor-pointer ring-2 ring-blue-500' : ''}`}
                onClick={handlePlayerGyClick}
              >
                {state.player.graveyard.length > 0 ? (
                  <CardView 
                    card={state.player.graveyard[state.player.graveyard.length - 1]} 
                    className="border-none w-full h-full" 
                    onMouseEnter={() => setShowCardDetail(state.player.graveyard[state.player.graveyard.length - 1])}
                    onMouseLeave={() => setShowCardDetail(null)}
                  />
                ) : (
                  <div className="text-zinc-700 font-mono text-[8px] sm:text-[10px] tracking-widest">GY</div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Battlefield */}
          <div ref={mobileBattlefieldRef} className="md:hidden flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
            <section className="rounded border border-zinc-800 bg-zinc-950/70 p-3 space-y-3">
              <div className="flex items-start gap-3">
                <div className="min-w-[88px] rounded border border-zinc-800 bg-black px-3 py-2">
                  <div className="text-zinc-500 text-[9px] font-mono uppercase tracking-widest">{opponentLabel} LP</div>
                  <motion.div
                    key={`mobile-opp-lp-${state.opponent.lp}`}
                    initial={{ opacity: 0.45, y: reduced ? 0 : -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={getSharedTransition(reduced, 'fast')}
                    className="text-xl font-mono text-white tracking-tighter"
                  >
                    {state.opponent.lp}
                  </motion.div>
                </div>
                <div className="grid flex-1 grid-cols-3 gap-2">
                  <div
                    className={`h-16 rounded border border-zinc-800 bg-zinc-950 flex items-center justify-center overflow-hidden ${uiState.type === 'SELECT_SPELL_TARGET' && uiState.spellCard.id === 'monster-reborn' ? 'cursor-pointer ring-2 ring-blue-500' : ''}`}
                    onClick={() => {
                      if (state.opponent.graveyard.length > 0) {
                        setShowCardDetail(state.opponent.graveyard[state.opponent.graveyard.length - 1]);
                      }
                      handleOpponentGyClick();
                    }}
                  >
                    {state.opponent.graveyard.length > 0 ? (
                      <CardView card={state.opponent.graveyard[state.opponent.graveyard.length - 1]} className="border-none w-full h-full" />
                    ) : (
                      <div className="theme-subtle font-mono text-[9px] tracking-widest">GY</div>
                    )}
                  </div>
                  <div className="h-16 rounded border border-zinc-800 bg-zinc-900 flex items-center justify-center" title="Main Deck">
                    <div className="theme-subtle font-mono text-[9px] tracking-widest text-center">DECK<br/>({state.opponent.deck.length})</div>
                  </div>
                  <div className="h-16 rounded border border-zinc-800 bg-zinc-900 flex items-center justify-center" title="Extra Deck">
                    <div className="theme-subtle font-mono text-[9px] tracking-widest text-center">EXTRA<br/>({state.opponent.extraDeck.length})</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="theme-eyebrow text-[10px]">{t('opponentHand')}</span>
                  <span className="theme-subtle text-[10px] font-mono uppercase tracking-widest">{state.opponent.hand.length} {t('cards')}</span>
                </div>
                <div className="overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <div className="flex gap-2 w-max">
                    {state.opponent.hand.map((card) => (
                      <CardView key={card.instanceId} card={card} isHidden className="shrink-0" />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="theme-eyebrow text-[10px]">{t('opponentField')}</div>
                <div className="grid grid-cols-5 gap-1.5 justify-items-center">
                  {state.opponent.monsterZone.map((card, i) => (
                    <CardView
                      key={i}
                      card={card}
                      onClick={() => {
                        if (card && card.position !== 'set-monster') setShowCardDetail(card);
                        handleOpponentMonsterClick(i);
                      }}
                      isSelectable={
                        (uiState.type === 'SELECT_ATTACK_TARGET' && card !== null) ||
                        (uiState.type === 'SELECT_SPELL_TARGET' && uiState.spellCard.id === 'tribute-to-the-doomed' && card !== null) ||
                        (uiState.type === 'SELECT_SPELL_TARGET' && uiState.spellCard.id === 'brain-control' && card !== null && card.position !== 'set-monster' && !card.isFusion)
                      }
                    />
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-1.5 justify-items-center">
                  {state.opponent.spellTrapZone.map((card, i) => (
                    <CardView
                      key={i}
                      card={card}
                      onClick={() => {
                        if (card && card.position !== 'set-spell') setShowCardDetail(card);
                        handleOpponentSpellTrapClick(i);
                      }}
                      isSelectable={
                        uiState.type === 'SELECT_SPELL_TARGET' &&
                        (uiState.spellCard.id === 'dust-tornado' || uiState.spellCard.id === 'de-spell') &&
                        card !== null
                      }
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded border border-zinc-800 bg-zinc-950/70 p-3 flex items-center justify-between gap-3">
              <div>
                <div className="theme-eyebrow text-[10px]">{t('currentPhase')}</div>
                <div className="theme-title text-sm mt-1">{getPhaseShortLabel(state.phase)}</div>
                <div className="theme-subtle text-[10px] font-mono mt-1">{getPhaseInstruction(state.phase, state.turn)}</div>
              </div>
              <button
                onClick={handleNextPhase}
                disabled={state.turn !== 'player' || state.phase === 'DP'}
                className="theme-button shrink-0 px-4 py-3 font-mono text-xs uppercase tracking-widest disabled:text-[var(--app-text-dim)] disabled:border-[var(--app-border)] flex items-center gap-2"
              >
                {t('next')}
                <ArrowRight size={16} />
              </button>
            </section>

            <section className="rounded border border-zinc-800 bg-zinc-950/70 p-3 space-y-3">
              <div className="space-y-2">
                <div className="theme-eyebrow text-[10px]">{t('yourField')}</div>
                <div className="grid grid-cols-5 gap-1.5 justify-items-center">
                  {state.player.spellTrapZone.map((card, i) => (
                    <CardView
                      key={i}
                      card={card}
                      action={
                        state.turn === 'player' &&
                        (state.phase === 'M1' || state.phase === 'M2') &&
                        card !== null &&
                        ((card.type === 'Spell' && canActivateCard(card, playerActivationContext, i)) ||
                          (card.type === 'Trap' && canActivateSetCard(card, playerActivationContext)))
                          ? 'activate'
                          : null
                      }
                      onClick={() => card && setShowCardDetail(card)}
                      onActionClick={(e) => handleSpellTrapActionClick(e, i)}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-1.5 justify-items-center">
                  {state.player.monsterZone.map((card, i) => (
                    <CardView
                      key={i}
                      card={card}
                      onClick={() => {
                        if (card) setShowCardDetail(card);
                        handlePlayerMonsterClick(i);
                      }}
                      isSelectable={
                        (uiState.type === 'SELECT_TRIBUTES' && card !== null) ||
                        (uiState.type === 'SELECT_FUSION_MATERIALS' && card !== null) ||
                        (uiState.type === 'SELECT_SPELL_TARGET' && uiState.spellCard.id === 'tribute-to-the-doomed' && card !== null) ||
                        (state.phase === 'BP' && card?.position === 'attack' && !card.hasAttacked) ||
                        ((state.phase === 'M1' || state.phase === 'M2') && card !== null && !card.justSummoned && !card.changedPosition && !card.hasAttacked)
                      }
                      isSelected={
                        (uiState.type === 'SELECT_TRIBUTES' && uiState.selected.includes(i)) ||
                        (uiState.type === 'SELECT_ATTACK_TARGET' && uiState.attackerIndex === i) ||
                        (uiState.type === 'SELECT_FUSION_MATERIALS' && card !== null && uiState.selectedMaterials.includes(card.instanceId))
                      }
                      action={state.turn === 'player' && state.phase === 'BP' && card?.position === 'attack' && !card.hasAttacked ? 'attack' : null}
                      onActionClick={(e) => handleMonsterActionClick(e, i)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="theme-eyebrow text-[10px]">{t('yourHand')}</span>
                  <span className="theme-subtle text-[10px] font-mono uppercase tracking-widest">{state.player.hand.length} {t('cards')}</span>
                </div>
                <div className="overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <div className="flex gap-2 w-max">
                    {state.player.hand.map((card) => (
                      <CardView
                        key={card.instanceId}
                        card={card}
                        onClick={() => {
                          setShowCardDetail(card);
                          handleHandCardClick(card);
                        }}
                        className="shrink-0"
                        isSelectable={state.turn === 'player' && (state.phase === 'M1' || state.phase === 'M2')}
                        isSelected={uiState.type === 'SELECT_FUSION_MATERIALS' && uiState.selectedMaterials.includes(card.instanceId)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="min-w-[88px] rounded border border-zinc-800 bg-black px-3 py-2">
                  <div className="text-zinc-500 text-[9px] font-mono uppercase tracking-widest">P1 LP</div>
                  <motion.div
                    key={`mobile-player-lp-${state.player.lp}`}
                    initial={{ opacity: 0.45, y: reduced ? 0 : -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={getSharedTransition(reduced, 'fast')}
                    className="text-xl font-mono text-white tracking-tighter"
                  >
                    {state.player.lp}
                  </motion.div>
                </div>
                <div className="grid flex-1 grid-cols-3 gap-2">
                  <div className="h-16 rounded border border-zinc-800 bg-zinc-900 flex items-center justify-center" title="Extra Deck">
                    <div className="font-mono text-[9px] tracking-widest text-zinc-400 text-center">EXTRA<br/>({state.player.extraDeck.length})</div>
                  </div>
                  <div
                    className={`h-16 rounded border bg-zinc-900 flex items-center justify-center cursor-pointer transition-all ${canPlayerDraw ? 'border-white border-dashed text-white' : 'border-zinc-800 text-zinc-400'}`}
                    onClick={handleDraw}
                    title="Main Deck"
                  >
                    <div className="font-mono text-[9px] tracking-widest text-center">DECK<br/>({state.player.deck.length})</div>
                  </div>
                  <div
                    className={`h-16 rounded border border-zinc-800 bg-zinc-950 flex items-center justify-center overflow-hidden ${uiState.type === 'SELECT_SPELL_TARGET' && uiState.spellCard.id === 'monster-reborn' ? 'cursor-pointer ring-2 ring-blue-500' : ''}`}
                    onClick={() => {
                      if (state.player.graveyard.length > 0) {
                        setShowCardDetail(state.player.graveyard[state.player.graveyard.length - 1]);
                      }
                      handlePlayerGyClick();
                    }}
                  >
                    {state.player.graveyard.length > 0 ? (
                      <CardView card={state.player.graveyard[state.player.graveyard.length - 1]} className="border-none w-full h-full" />
                    ) : (
                      <div className="theme-subtle font-mono text-[9px] tracking-widest">GY</div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* UI Overlays */}
          {uiState.type === 'SELECT_HAND_CARD' && (
            <motion.div
              className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
              onClick={() => setUiState({ type: 'IDLE' })}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={getSharedTransition(reduced, 'fast')}
            >
              <motion.div
                className="bg-black p-6 rounded border border-zinc-700 flex flex-col items-center gap-6 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: reduced ? 0 : 10, scale: reduced ? 1 : 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: reduced ? 0 : -8, scale: reduced ? 1 : 0.99 }}
                transition={getSharedTransition(reduced, 'normal')}
              >
                <span className="text-white font-sans text-xl tracking-wide uppercase">{uiState.card.name}</span>
                {(() => {
                  const availableActions = getHandCardActionAvailability(uiState.card, playerActivationContext);
                  return (
                <div className="flex gap-4">
                  {uiState.card.type === 'Monster' && (
                    <>
                      {availableActions.summon && (
                        <button onClick={() => executeHandAction('summon')} className="border border-zinc-600 hover:bg-white hover:text-black text-white px-6 py-2 font-mono text-sm transition-colors">
                          SUMMON
                        </button>
                      )}
                      {availableActions.setMonster && (
                        <button onClick={() => executeHandAction('set')} className="border border-zinc-600 hover:bg-white hover:text-black text-white px-6 py-2 font-mono text-sm transition-colors">
                          SET
                        </button>
                      )}
                    </>
                  )}
                  {(uiState.card.type === 'Spell' || uiState.card.type === 'Trap') && (
                    <>
                      {uiState.card.type === 'Spell' && availableActions.activate && (
                        <button onClick={() => executeHandAction('activate')} className="border border-zinc-600 hover:bg-white hover:text-black text-white px-6 py-2 font-mono text-sm transition-colors">
                          ACTIVATE
                        </button>
                      )}
                      {availableActions.setSpellTrap && (
                        <button onClick={() => executeHandAction('set')} className="border border-zinc-600 hover:bg-white hover:text-black text-white px-6 py-2 font-mono text-sm transition-colors">
                          SET
                        </button>
                      )}
                    </>
                  )}
                </div>
                  );
                })()}
                <button onClick={() => setUiState({ type: 'IDLE' })} className="text-xs font-mono text-zinc-500 hover:text-white mt-2 uppercase tracking-widest">{t('cancel')}</button>
              </motion.div>
            </motion.div>
          )}
          {uiState.type === 'SELECT_TRIBUTES' && (
            <motion.div
              className="absolute inset-x-0 top-16 md:top-20 z-50 flex justify-center p-4 pointer-events-none"
              initial={{ opacity: 0, y: reduced ? 0 : -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -8 }}
              transition={getSharedTransition(reduced, 'fast')}
            >
              <div className="bg-black/95 p-4 rounded border border-zinc-700 text-white font-mono text-sm tracking-widest flex flex-col items-center gap-3 pointer-events-auto shadow-2xl">
                <span>{t('selectTributes', { count: uiState.count }).toUpperCase()}</span>
                <button onClick={() => setUiState({ type: 'IDLE' })} className="text-xs font-mono text-zinc-500 hover:text-white uppercase tracking-widest">{t('cancel')}</button>
              </div>
            </motion.div>
          )}
          {uiState.type === 'SELECT_DISCARD' && (
            <div className="absolute inset-x-0 top-16 md:top-20 z-50 flex justify-center p-4 pointer-events-none">
              <div className="bg-black/95 p-4 rounded border border-zinc-700 text-white font-mono text-sm tracking-widest flex flex-col items-center gap-3 pointer-events-auto shadow-2xl">
                <span>{t('selectCardToDiscard').toUpperCase()}</span>
                <button onClick={() => setUiState({ type: 'IDLE' })} className="text-xs font-mono text-zinc-500 hover:text-white uppercase tracking-widest">{t('cancel')}</button>
              </div>
            </div>
          )}
          {uiState.type === 'SELECT_SPELL_TARGET' && (
            <div className="absolute inset-x-0 top-16 md:top-20 z-50 flex justify-center p-4 pointer-events-none">
              <div className="bg-black/95 p-4 rounded border border-zinc-700 text-white font-mono text-sm tracking-widest flex flex-col items-center gap-3 pointer-events-auto shadow-2xl max-w-[90vw] text-center">
                <span>{t('selectTargetFor', { name: getLocalizedCardText(uiState.spellCard, language).name }).toUpperCase()}</span>
                <button onClick={() => setUiState({ type: 'IDLE' })} className="text-xs font-mono text-zinc-500 hover:text-white uppercase tracking-widest">{t('cancel')}</button>
              </div>
            </div>
          )}
          {uiState.type === 'SELECT_ZONE_CARD' && (
            <motion.div
              className="absolute inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
              onClick={() => setUiState({ type: 'IDLE' })}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={getSharedTransition(reduced, 'fast')}
            >
              <motion.div
                className="bg-black p-6 rounded border border-zinc-700 text-white w-full max-w-5xl pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: reduced ? 0 : -8, scale: reduced ? 1 : 0.99 }}
                transition={getSharedTransition(reduced, 'normal')}
              >
                <div className="flex flex-col items-center gap-2 mb-6 text-center">
                  <span className="font-mono text-lg tracking-widest uppercase">{uiState.title}</span>
                  <span className="text-sm text-zinc-400">{uiState.description}</span>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 justify-items-center">
                    {uiState.cards.map(({ card, sourceIndex }) => (
                      <div
                        key={`${card.instanceId}-${sourceIndex}`}
                        className="cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => handleZoneCardSelection(sourceIndex)}
                        onMouseEnter={() => setShowCardDetail(card)}
                        onMouseLeave={() => setShowCardDetail(null)}
                      >
                        <CardView card={card} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-6 flex justify-center">
                  <button onClick={() => setUiState({ type: 'IDLE' })} className="text-xs font-mono text-zinc-500 hover:text-white uppercase tracking-widest">{t('cancel')}</button>
                </div>
              </motion.div>
            </motion.div>
          )}
          {uiState.type === 'CONFIRM_RESPONSE' && (
            <motion.div
              className="absolute inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
              onClick={() => resolvePendingResponse()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={getSharedTransition(reduced, 'fast')}
            >
              <motion.div
                className="bg-black p-6 rounded border border-zinc-700 text-white w-full max-w-xl pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: reduced ? 0 : 10, scale: reduced ? 1 : 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: reduced ? 0 : -8, scale: reduced ? 1 : 0.99 }}
                transition={getSharedTransition(reduced, 'normal')}
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <span className="font-mono text-lg tracking-widest uppercase">Response Window</span>
                  <span className="text-sm text-zinc-400">{uiState.message}</span>
                </div>
                <div className="mt-6 flex flex-col gap-3">
                  {uiState.options.map(option => (
                    <button
                      key={option.card.instanceId}
                      onClick={() => resolvePendingResponse(option.card.instanceId)}
                      className="border border-zinc-700 hover:border-white hover:bg-zinc-900 px-4 py-4 text-left transition-colors"
                    >
                      <div className="font-mono text-sm uppercase tracking-widest text-white">{option.title}</div>
                      <div className="text-xs text-zinc-400 mt-1">{option.description}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex justify-center">
                  <button onClick={() => resolvePendingResponse()} className="text-xs font-mono text-zinc-500 hover:text-white uppercase tracking-widest">Skip Activation</button>
                </div>
              </motion.div>
            </motion.div>
          )}
          {uiState.type === 'SELECT_FUSION_MONSTER' && (
            <motion.div
              className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
              onClick={() => setUiState({ type: 'IDLE' })}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={getSharedTransition(reduced, 'fast')}
            >
              <motion.div
                className="bg-black p-6 rounded border border-zinc-700 text-white font-mono text-lg tracking-widest flex flex-col items-center gap-4 pointer-events-auto max-w-2xl w-full"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: reduced ? 0 : -8, scale: reduced ? 1 : 0.99 }}
                transition={getSharedTransition(reduced, 'normal')}
              >
                <span>{t('selectFusionMonster').toUpperCase()}</span>
                <div className="flex flex-wrap gap-4 justify-center mt-4">
                  {uiState.possibleFusions.map(fm => (
                    <div key={fm.instanceId} className="cursor-pointer hover:scale-105 transition-transform" onClick={() => {
                      setUiState({
                        type: 'SELECT_FUSION_MATERIALS',
                        fusionMonster: fm,
                        spellInstanceId: uiState.spellInstanceId,
                        fromZone: uiState.fromZone,
                        selectedMaterials: []
                      });
                      showNotice(t('selectMaterialsFor', { name: getLocalizedCardText(fm, language).name }), t('actionRequired'));
                    }}>
                      <CardView 
                        card={fm} 
                        onMouseEnter={() => setShowCardDetail(fm)}
                        onMouseLeave={() => setShowCardDetail(null)}
                      />
                    </div>
                  ))}
                </div>
                <button onClick={() => setUiState({ type: 'IDLE' })} className="text-xs font-mono text-zinc-500 hover:text-white uppercase tracking-widest mt-4">{t('cancel')}</button>
              </motion.div>
            </motion.div>
          )}
          {uiState.type === 'SELECT_FUSION_MATERIALS' && (
            <motion.div
              className="absolute inset-x-0 top-16 md:top-20 z-50 flex justify-center p-4 pointer-events-none"
              initial={{ opacity: 0, y: reduced ? 0 : -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -8 }}
              transition={getSharedTransition(reduced, 'fast')}
            >
              <div className="bg-black/95 p-4 rounded border border-zinc-700 text-white font-mono text-sm tracking-widest flex flex-col items-center gap-3 pointer-events-auto shadow-2xl text-center">
                <span>{t('selectMaterialsFor', { name: getLocalizedCardText(uiState.fusionMonster, language).name }).toUpperCase()}</span>
                <span className="text-sm text-zinc-400">{t('selectedCount', { selected: uiState.selectedMaterials.length, total: uiState.fusionMonster.fusionMaterials?.length || 0 })}</span>
                <button onClick={() => setUiState({ type: 'IDLE' })} className="text-xs font-mono text-zinc-500 hover:text-white uppercase tracking-widest">{t('cancel')}</button>
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {pendingCpuModeSelection && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={getSharedTransition(reduced, 'fast')}
                className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -8, scale: reduced ? 1 : 0.99 }}
                  transition={getSharedTransition(reduced, 'normal')}
                  className="w-full max-w-md border border-zinc-700 bg-black p-6 flex flex-col items-center text-center"
                >
                  <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500 mb-3">
                    {t('cpuMode')}
                  </div>
                  <h2 className="text-xl font-sans font-bold uppercase tracking-wide text-white mb-2">
                    {t('selectDeckType')}
                  </h2>
                  <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-6">
                    {t('playDeckChoicePrompt')}
                  </p>
                  <div className="w-full flex flex-col gap-3">
                    <button
                      onClick={startRandomGame}
                      className="border border-zinc-600 hover:bg-white hover:text-black text-white px-4 py-3 font-mono text-sm uppercase tracking-widest transition-colors"
                    >
                      {t('randomDeck')}
                    </button>
                    <button
                      onClick={startCustomGame}
                      className="border border-zinc-600 hover:bg-white hover:text-black text-white px-4 py-3 font-mono text-sm uppercase tracking-widest transition-colors"
                    >
                      {t('customDeck')}
                    </button>
                    <button
                      onClick={returnToMenu}
                      className="text-xs font-mono uppercase tracking-widest text-zinc-500 hover:text-white mt-2"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showMenuConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={getSharedTransition(reduced, 'fast')}
                className="absolute inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
                onClick={() => setShowMenuConfirm(false)}
              >
                <motion.div
                  initial={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -8, scale: reduced ? 1 : 0.99 }}
                  transition={getSharedTransition(reduced, 'normal')}
                  className="w-full max-w-md border border-zinc-700 bg-black p-6 flex flex-col items-center text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500 mb-3">
                    {menuPromptContent.eyebrow}
                  </div>
                  <h2 className="text-xl font-sans font-bold uppercase tracking-wide text-white mb-3">
                    {menuPromptContent.title}
                  </h2>
                  <p className="text-sm text-zinc-300 leading-6 mb-3">
                    {menuPromptContent.message}
                  </p>
                  <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-zinc-500 mb-6">
                    {menuPromptContent.detail}
                  </p>
                  <div className="w-full flex flex-col gap-3">
                    <button
                      onClick={() => void forfeitToMenu()}
                      className="border border-zinc-600 hover:bg-white hover:text-black text-white px-4 py-3 font-mono text-sm uppercase tracking-widest transition-colors"
                    >
                      {menuPromptContent.confirmLabel}
                    </button>
                    <button
                      onClick={() => setShowMenuConfirm(false)}
                      className="text-xs font-mono uppercase tracking-widest text-zinc-500 hover:text-white"
                    >
                      {menuPromptContent.cancelLabel}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showCompetitionIntro && currentCompetitionOpponent && !state.winner && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={getSharedTransition(reduced, 'fast')}
                className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -8, scale: reduced ? 1 : 0.99 }}
                  transition={getSharedTransition(reduced, 'normal')}
                  className="w-full max-w-lg border border-zinc-700 bg-black p-6 flex flex-col items-center text-center gap-5"
                >
                  <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">
                    {t('stageHeading', { stage: currentCompetitionOpponent.stage, total: currentCompetitionOpponent.totalStages })}
                  </div>
                  <h2 className="text-3xl font-mono uppercase tracking-[0.16em] text-white">
                    {localizedCompetitionContent?.name ?? currentCompetitionOpponent.name}
                  </h2>
                  <p className="max-w-md text-base text-zinc-200 leading-7">
                    {localizedCompetitionContent?.introLine ?? currentCompetitionOpponent.voice.intro}
                  </p>
                  <div className="pt-1">
                    <button
                      onClick={() => setShowCompetitionIntro(false)}
                      className="border border-zinc-600 hover:bg-white hover:text-black text-white px-6 py-3 font-mono text-sm uppercase tracking-widest transition-colors"
                    >
                      {t('beginDuel')}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Winner Overlay */}
          <AnimatePresence>
            {state.winner && !pendingCpuModeSelection && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduced ? 1 : 0.98 }}
                transition={getSharedTransition(reduced, 'normal')}
                className="absolute inset-0 bg-black/90 flex items-center justify-center z-50"
              >
                {gameMode === 'competition' && currentCompetitionOpponent ? (
                  <div className="w-full max-w-2xl border border-zinc-700 bg-black p-6 flex flex-col gap-6 text-center">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">
                        {t('stageHeading', { stage: currentCompetitionOpponent.stage, total: currentCompetitionOpponent.totalStages })}
                      </div>
                      <h1 className="mt-3 text-5xl font-mono tracking-[0.18em] text-white uppercase">
                        {state.winner === 'player' ? t('winnerVictory') : t('winnerDefeat')}
                      </h1>
                      <div className="mt-3 text-sm font-mono uppercase tracking-[0.16em] text-zinc-500">
                        {state.winner === 'player'
                          ? t('stageCleared', { name: localizedCompetitionContent?.name ?? currentCompetitionOpponent.name })
                          : t('forfeitEliminatedBy', { name: localizedCompetitionContent?.name ?? currentCompetitionOpponent.name })}
                      </div>
                    </div>
                    {(() => {
                      const summary = getCompetitionSummaryStats();
                      if (!summary) return null;
                      return (
                        <>
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="border border-zinc-800 bg-zinc-950 px-4 py-4">
                              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">{t('turns')}</div>
                              <div className="mt-2 text-lg font-mono text-white">{summary.turnsSurvived}</div>
                            </div>
                            <div className="border border-zinc-800 bg-zinc-950 px-4 py-4">
                              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">{t('lpRemaining')}</div>
                              <div className="mt-2 text-lg font-mono text-white">{summary.lpRemaining}</div>
                            </div>
                            <div className="border border-zinc-800 bg-zinc-950 px-4 py-4">
                              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">{t('finish')}</div>
                              <div className="mt-2 text-sm font-mono uppercase tracking-[0.12em] text-white">
                                {summary.finishingCard ?? t('duelEnd')}
                              </div>
                            </div>
                          </div>
                          <div className="border border-zinc-800 bg-zinc-950 px-4 py-4 text-left">
                            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">{t('summary')}</div>
                            <div className="mt-3 text-sm text-zinc-300 leading-6">{summary.summaryLine}</div>
                            <div className="mt-3 text-xs font-mono text-zinc-500 leading-5">{summary.notablePlay}</div>
                          </div>
                        </>
                      );
                    })()}
                    <button
                      onClick={() => {
                        if (state.winner === 'player') {
                          advanceCompetition();
                          return;
                        }
                        returnToMenu();
                      }}
                      className="border border-zinc-600 hover:bg-white hover:text-black text-white px-8 py-3 font-mono text-sm transition-colors"
                    >
                      {state.winner === 'player'
                        ? (competitionStageIndex !== null && competitionStageIndex < COMPETITION_LADDER.length - 1 ? t('nextDuel') : t('claimTitle'))
                        : t('returnToMenu')}
                    </button>
                  </div>
                ) : (
                  <div className="text-center flex flex-col items-center gap-8">
                    <h1 className="text-6xl font-sans tracking-widest text-white uppercase">
                      {state.winner === 'player' ? t('winnerVictory') : t('winnerDefeat')}
                    </h1>
                    <button
                      onClick={returnToMenu}
                      className="border border-zinc-600 hover:bg-white hover:text-black text-white px-8 py-3 font-mono text-sm transition-colors"
                    >
                      {t('playAgain')}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden md:flex w-80 h-full bg-zinc-950 border-l border-zinc-800 flex-col shrink-0">
          <div className="flex-1 p-6 border-b border-zinc-800 flex flex-col items-center justify-center overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {renderCardDetailPanel(t('clickCardForDetails'))}
          </div>

          <div className="h-1/2 p-4 flex flex-col shrink-0">
            <h3 className="theme-eyebrow mb-4 text-[10px]">{t('duelLog')}</h3>
            {renderDuelLogPanel()}
          </div>
        </div>

        {/* Mobile Info Panel */}
        <div className={`theme-panel md:hidden fixed inset-x-2 bottom-[max(env(safe-area-inset-bottom),10px)] z-30 rounded-[12px] flex flex-col overflow-hidden shadow-xl transition-[height] duration-200 ${mobileInfoExpanded ? 'h-[31vh] min-h-[220px] max-h-[320px]' : 'h-[52px]'}`}>
          <div className="theme-divider grid grid-cols-[1fr_1fr_auto] border-b shrink-0">
            <button
              onClick={() => handleMobileInfoTabChange('details')}
              className={`px-2 py-2 text-[7px] font-mono uppercase tracking-[0.1em] transition-colors ${mobileInfoTab === 'details' ? 'theme-chip-active' : 'theme-chip'}`}
            >
              {t('cardInfo')}
            </button>
            <button
              onClick={() => handleMobileInfoTabChange('log')}
              className={`px-2 py-2 text-[7px] font-mono uppercase tracking-[0.1em] transition-colors ${mobileInfoTab === 'log' ? 'theme-chip-active' : 'theme-chip'}`}
            >
              {t('duelLog')}
            </button>
            <button
              onClick={() => setMobileInfoExpanded((prev) => !prev)}
              className="theme-subtle theme-divider flex items-center justify-center border-l px-2.5 transition-colors"
              aria-label={mobileInfoExpanded ? t('collapseMobileInfoPanel') : t('expandMobileInfoPanel')}
            >
              {mobileInfoExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {mobileInfoExpanded && (
              <motion.div
                key="mobile-info-panel-body"
                initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : 8 }}
                transition={getSharedTransition(reduced, 'fast')}
                className="flex-1 overflow-y-auto p-2"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {mobileInfoTab === 'details' ? (
                    <motion.div
                      key="mobile-details"
                      initial={{ opacity: 0, x: reduced ? 0 : -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: reduced ? 0 : 8 }}
                      transition={getSharedTransition(reduced, 'fast')}
                      className="min-h-full"
                    >
                      {renderMobileCardDetailPanel(t('tapFaceUpCardToInspect'))}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="mobile-log"
                      initial={{ opacity: 0, x: reduced ? 0 : 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: reduced ? 0 : -8 }}
                      transition={getSharedTransition(reduced, 'fast')}
                      className="flex flex-col min-h-full"
                    >
                      {renderDuelLogPanel(true)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>
      )}
    </>
  );
}


