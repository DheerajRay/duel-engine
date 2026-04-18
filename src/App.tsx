import React, { Suspense, lazy, useReducer, useEffect, useState, useRef } from 'react';
import { gameReducer, initialState, type Action } from './engine/reducer';
import { AnnouncementOverlay } from './components/AnnouncementOverlay';
import { CardView } from './components/CardView';
import { AnnouncementInput, useAnnouncementQueue } from './hooks/useAnnouncementQueue';
import { GameCard, LogEntry, Phase } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ChevronDown, ChevronUp, Settings } from 'lucide-react';
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
import { appendDuelHistoryEntry } from './services/history';
import {
  clearCompetitionProgress,
  ensureStarterCustomDeck,
  getCompetitionProgress,
  getPrimaryDeckSnapshot,
  setCompetitionProgress,
} from './services/userData';
import type { DuelHistoryEntry, UserProfile } from './types/cloud';

const DeckBuilder = lazy(() => import('./pages/DeckBuilder'));
const HowToPlay = lazy(() => import('./pages/HowToPlay'));
const SignInPage = lazy(() => import('./pages/SignInPage'));
const GameHistoryPage = lazy(() => import('./pages/GameHistoryPage'));

const BOOT_TIMEOUT_MS = 900;

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
  const [view, setView] = useState<'start' | 'game' | 'deck-builder' | 'how-to-play' | 'sign-in' | 'history'>('start');
  const [gameMode, setGameMode] = useState<'random' | 'custom' | 'competition' | null>(null);
  const [competitionStageIndex, setCompetitionStageIndex] = useState<number | null>(null);
  const [competitionResumeStageIndex, setCompetitionResumeStageIndex] = useState(0);
  const [pendingCpuModeSelection, setPendingCpuModeSelection] = useState(false);
  const [showMenuConfirm, setShowMenuConfirm] = useState(false);
  const [showCompetitionLobby, setShowCompetitionLobby] = useState(false);
  const [showCompetitionIntro, setShowCompetitionIntro] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [bootState, setBootState] = useState<'ready' | 'error'>('ready');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [uiState, setUiState] = useState<UIState>({ type: 'IDLE' });
  const [showCardDetail, setShowCardDetail] = useState<GameCard | null>(null);
  const [mobileInfoTab, setMobileInfoTab] = useState<'details' | 'log'>('details');
  const [mobileInfoExpanded, setMobileInfoExpanded] = useState(false);
  const [aiResumeTick, setAiResumeTick] = useState(0);
  const prevLogLengthRef = useRef(state.log.length);
  const prevPlayerPhaseKeyRef = useRef<string | null>(null);
  const duelHistorySavedRef = useRef<string | null>(null);
  const mobileBattlefieldRef = useRef<HTMLDivElement | null>(null);
  const authBootstrappedRef = useRef(false);
  const currentCompetitionOpponent = competitionStageIndex !== null ? COMPETITION_LADDER[competitionStageIndex] : null;
  const competitionResumeOpponent = COMPETITION_LADDER[competitionResumeStageIndex];
  const competitionSignatureCards = currentCompetitionOpponent?.signatureCardIds.map(buildCompetitionPreviewCard) ?? [];
  const opponentLabel = currentCompetitionOpponent?.name ?? 'COM';
  const opponentShortLabel = currentCompetitionOpponent?.name.split(' ')[0] ?? 'Opponent';
  const cpuModeHeading =
    gameMode === 'random'
      ? 'CPU Mode: Random Deck'
      : gameMode === 'custom'
        ? 'CPU Mode: Custom Deck'
        : pendingCpuModeSelection
          ? 'CPU Mode'
          : null;
  const canPlayerDraw = state.turn === 'player' && state.phase === 'DP';
  const hasActiveDuel = view === 'game' && !pendingCpuModeSelection && gameMode !== null && !state.winner;
  const { reduced } = useMotionPreference();
  const { activeAnnouncement, announce, clearAnnouncements } = useAnnouncementQueue(990);
  const playerActivationContext = {
    player: state.player,
    opponent: state.opponent,
    normalSummonUsed: state.normalSummonUsed,
    phase: state.phase,
  };

  const showAnnouncement = (input: AnnouncementInput) => announce(input);
  const showNotice = (message: string, title = 'Notice') => announce({ title, message });

  const getPhaseAnnouncement = (phase: Phase) => {
    switch (phase) {
      case 'DP':
        return 'Draw Phase';
      case 'M1':
        return 'Main Phase 1';
      case 'BP':
        return 'Battle Phase';
      case 'M2':
        return 'Main Phase 2';
      case 'EP':
        return 'End Phase';
      default:
        return phase;
    }
  };

  const getPhaseInstruction = (phase: Phase, turn: 'player' | 'opponent') => {
    if (turn !== 'player') {
      switch (phase) {
        case 'DP':
          return 'Opponent draws to begin their turn.';
        case 'M1':
          return 'Opponent can summon, set, or activate cards.';
        case 'BP':
          return 'Opponent can declare attacks from here.';
        case 'M2':
          return 'Opponent can make one more round of plays.';
        case 'EP':
          return 'Opponent finishes the turn and control returns to you.';
        default:
          return '';
      }
    }

    switch (phase) {
      case 'DP':
        return 'Draw by tapping your deck during DP.';
      case 'M1':
        return 'Summon, set, change position, or activate cards.';
      case 'BP':
        return 'Attack with your monsters or press Next to continue.';
      case 'M2':
        return 'Make any final plays before ending your turn.';
      case 'EP':
        return 'Press Next to end your turn and pass to the opponent.';
      default:
        return '';
    }
  };

  const getCompetitionSummaryStats = () => {
    if (!currentCompetitionOpponent) return null;

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
      notablePlay: getCompetitionNotablePlay(state.log),
      summaryLine: state.winner === 'player'
        ? currentCompetitionOpponent.summaryLines.stageClear
        : currentCompetitionOpponent.summaryLines.defeat,
    };
  };

  const renderLazyScreenFallback = (label: string) => (
    <div className="h-dvh md:h-screen box-border bg-black flex items-center justify-center text-white font-mono uppercase tracking-widest pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:p-0">
      <div className="border border-zinc-800 bg-zinc-950 px-6 py-4 text-sm text-zinc-400">
        Loading {label}
      </div>
    </div>
  );

  const getDisplayLogMessage = (logEntry: LogEntry) => {
    if (gameMode === 'competition' && currentCompetitionOpponent) {
      return formatCompetitionLogMessage(logEntry, currentCompetitionOpponent);
    }

    return logEntry.message;
  };

  // Center-screen announcements for duel log entries
  useEffect(() => {
    if (state.log.length < prevLogLengthRef.current) {
      prevLogLengthRef.current = 0;
    }

    if (state.log.length > prevLogLengthRef.current) {
      const newLogs = state.log.slice(prevLogLengthRef.current);
      announce(newLogs.map((entry) => ({
        title: 'Duel Event',
        message: getDisplayLogMessage(entry),
      })));
      prevLogLengthRef.current = state.log.length;
    }
  }, [state.log, gameMode, currentCompetitionOpponent, announce]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        void withTimeout(
          initializeGameContent(),
          { source: 'local' as const, bundle: null as never },
          BOOT_TIMEOUT_MS,
        );

        const user = await withTimeout(getCurrentUser(), null, BOOT_TIMEOUT_MS);

        setUserProfile(user ? toUserProfile(user, null) : null);
        setShowAuthPrompt(!user);

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

        if (user) {
          void withTimeout(ensureProfile(user), null).then((profile) => {
            if (profile) {
              setUserProfile(profile);
            }
          });
        }
      } catch {
        setBootState('error');
      } finally {
        authBootstrappedRef.current = true;
      }
    };

    const unsubscribe = onAuthStateChange((profile) => {
      setUserProfile(profile);
      if (!authBootstrappedRef.current) {
        return;
      }

      setShowAuthPrompt(!profile);
    });

    void bootstrap();

    return () => {
      unsubscribe();
    };
  }, []);

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
      const fallbackNotablePlay = [...state.log].reverse().find((entry) => entry.message)?.message ?? 'The duel ended without a standout play.';
      const finishingCard =
        [...state.log].reverse().find((entry) => entry.data?.cardName)?.data?.cardName ?? null;

      const historyEntry: DuelHistoryEntry = {
        id: `duel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mode: gameMode === 'competition' ? 'competition' : gameMode === 'custom' ? 'cpu_custom' : 'cpu_random',
        opponentLabel: currentCompetitionOpponent?.name ?? (gameMode === 'custom' ? 'CPU Custom' : 'CPU Random'),
        stageIndex: competitionStageIndex,
        result: state.winner === 'player' ? 'win' : 'loss',
        turnCount: state.turnCount,
        lpRemaining: state.winner === 'player' ? state.player.lp : state.opponent.lp,
        finishingCard,
        notablePlay: summary?.notablePlay ?? fallbackNotablePlay,
        summary: summary?.summaryLine ?? (state.winner === 'player' ? 'You won the duel.' : 'You lost the duel.'),
        logs: state.log,
        createdAt: new Date().toISOString(),
      };

      await appendDuelHistoryEntry(historyEntry);
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
    setShowAuthPrompt(false);
  };

  const handleHomeAuthAction = async () => {
    if (!userProfile) {
      setView('sign-in');
      return;
    }

    await signOut();
    setUserProfile(null);
    setShowAuthPrompt(true);
  };

  const forfeitToMenu = async () => {
    if (hasActiveDuel) {
      await appendDuelHistoryEntry({
        id: `duel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mode: gameMode === 'competition' ? 'competition' : gameMode === 'custom' ? 'cpu_custom' : 'cpu_random',
        opponentLabel: currentCompetitionOpponent?.name ?? (gameMode === 'custom' ? 'CPU Custom' : 'CPU Random'),
        stageIndex: competitionStageIndex,
        result: 'forfeit',
        turnCount: state.turnCount,
        lpRemaining: state.player.lp,
        finishingCard: null,
        notablePlay: getCompetitionNotablePlay(state.log),
        summary: 'You forfeited the duel from the in-game menu.',
        logs: state.log,
        createdAt: new Date().toISOString(),
      });
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
      showNotice('Your custom deck must have at least 40 cards. Please use the Deck Builder.', 'Deck Required');
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
      showNotice('Competition Mode uses your saved custom deck. Build a 40-card deck first.', 'Deck Required');
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
      showNotice('Competition cleared. You defeated every duelist in the ladder.', 'Competition');
      returnToMenu();
      return;
    }

    void startCompetitionDuel(nextStageIndex);
  };

  const getMenuPromptContent = () => {
    if (gameMode === 'competition' && currentCompetitionOpponent) {
      return {
        eyebrow: `Stage ${currentCompetitionOpponent.stage} of ${currentCompetitionOpponent.totalStages}`,
        title: 'Forfeit Duel?',
        message: currentCompetitionOpponent.voice.forfeit,
        detail: `Your ladder progress will stay at ${currentCompetitionOpponent.name}.`,
        confirmLabel: 'Forfeit Duel',
        cancelLabel: 'Stay in Duel',
      };
    }

    if (gameMode === 'custom') {
      return {
        eyebrow: 'CPU Mode: Custom Deck',
        title: 'Forfeit Duel?',
        message: 'The CPU smirks. "Walking out already? Leave now and this duel is a forfeit."',
        detail: 'You will return to the menu and can start a fresh custom duel any time.',
        confirmLabel: 'Forfeit Duel',
        cancelLabel: 'Stay in Duel',
      };
    }

    return {
      eyebrow: 'CPU Mode: Random Deck',
      title: 'Forfeit Duel?',
      message: 'The CPU shrugs. "No dramatic finish? Leave now and I will take the win by forfeit."',
      detail: 'You will return to the menu and can spin up another random duel immediately.',
      confirmLabel: 'Forfeit Duel',
      cancelLabel: 'Stay in Duel',
    };
  };

  const menuPromptContent = getMenuPromptContent();

  const renderPhaseTracker = (className = 'flex gap-3 text-xs font-mono') => (
    <div className={className}>
      {['DP', 'M1', 'BP', 'M2', 'EP'].map((p) => (
        <motion.span
          key={p}
          animate={{
            color: state.phase === p ? '#ffffff' : '#52525b',
            y: state.phase === p && !reduced ? -1 : 0,
          }}
          transition={getSharedTransition(reduced, 'fast')}
          className={state.phase === p ? 'font-bold' : ''}
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
    return (
      <motion.div
        key={showCardDetail.instanceId}
        initial={{ opacity: 0, y: reduced ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={getSharedTransition(reduced, 'fast')}
        className="w-full max-w-[220px] rounded border border-zinc-700 p-4 flex flex-col bg-black"
      >
        <div className="font-sans text-xl font-bold leading-tight mb-2 text-white uppercase tracking-wider">{showCardDetail.name}</div>
        <div className="text-[10px] font-mono text-zinc-500 mb-4 uppercase tracking-widest border-b border-zinc-800 pb-2 flex justify-between gap-2">
          <span>[{showCardDetail.type}{showCardDetail.subType ? ` / ${showCardDetail.subType}` : ''}]</span>
          {showCardDetail.type === 'Monster' && (
            <span>LVL {showCardDetail.level} {showCardDetail.level! >= 7 ? '(2 Tributes)' : showCardDetail.level! >= 5 ? '(1 Tribute)' : ''}</span>
          )}
        </div>
        <div className="text-xs text-zinc-400 font-sans leading-relaxed">
          {showCardDetail.description}
        </div>
        {(showCardDetail.type !== 'Monster' || supportMeta.status !== 'implemented') && (
          <div className="mt-4 border-t border-zinc-800 pt-3 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
            <div className="text-zinc-400">{supportMeta.label}</div>
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
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">Fusion Materials</div>
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
          className="text-zinc-600 text-xs font-mono uppercase tracking-widest text-center px-6"
        >
          {emptyMessage}
        </motion.div>
      );
    }

    const supportMeta = getCardSupportMeta(showCardDetail);
    return (
      <motion.div
        key={showCardDetail.instanceId}
        initial={{ opacity: 0, y: reduced ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={getSharedTransition(reduced, 'fast')}
        className="w-full rounded border border-zinc-800 bg-black"
      >
        <div className="border-b border-zinc-800 px-4 py-3">
          <div className="text-xl font-sans font-bold leading-tight text-white uppercase tracking-wide">
            {showCardDetail.name}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-400">
            <span className="border border-zinc-800 bg-zinc-950 px-2 py-1">
              {showCardDetail.type}
              {showCardDetail.subType ? ` / ${showCardDetail.subType}` : ''}
            </span>
            {showCardDetail.type === 'Monster' && (
              <span className="border border-zinc-800 bg-zinc-950 px-2 py-1">
                Lvl {showCardDetail.level}
              </span>
            )}
            {showCardDetail.type === 'Monster' && (
              <span className="border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-500">
                {showCardDetail.level! >= 7 ? '2 Tributes' : showCardDetail.level! >= 5 ? '1 Tribute' : 'No Tribute'}
              </span>
            )}
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          {showCardDetail.type === 'Monster' && (
            <div className="border-t border-zinc-800 pt-3">
              <div className="flex items-center gap-5 font-mono text-sm uppercase tracking-[0.2em]">
                <span className="text-zinc-500">ATK <span className="text-white tracking-normal">{showCardDetail.atk}</span></span>
                <span className="text-zinc-500">DEF <span className="text-white tracking-normal">{showCardDetail.def}</span></span>
              </div>
            </div>
          )}

          <div className="text-xs leading-6 text-zinc-300">
            {showCardDetail.description}
          </div>

          {(showCardDetail.type !== 'Monster' || supportMeta.status !== 'implemented') && (
            <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2.5">
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
                {supportMeta.label}
              </div>
              {supportMeta.note && (
                <div className="text-[11px] text-zinc-300 leading-5">
                  {supportMeta.note}
                </div>
              )}
            </div>
          )}

          {showCardDetail.isFusion && showCardDetail.fusionMaterials && (
            <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2.5">
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
                Fusion Materials
              </div>
              <div className="text-[11px] text-zinc-300 leading-5">
                {showCardDetail.fusionMaterials.join(' + ')}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const renderDuelLogPanel = () => (
    <div className="flex-grow overflow-y-auto flex flex-col gap-2 text-[11px] font-mono text-zinc-400">
      {[...state.log].reverse().map((entry, i) => {
        const isPlayer = entry.data?.player === 'player' || entry.data?.nextTurn === 'player';
        const isOpponent = entry.data?.player === 'opponent' || entry.data?.nextTurn === 'opponent';
        const isBoth = entry.data?.player === 'both';
        const displayMessage = getDisplayLogMessage(entry);
        
        let textColor = 'text-zinc-400';
        let prefix = '';
        
        if (entry.type === 'DUEL_START') {
          textColor = 'text-yellow-400';
          prefix = '[System] ';
        } else if (entry.type === 'NEXT_TURN') {
          textColor = isPlayer ? 'text-blue-400' : 'text-red-400';
          prefix = isPlayer ? '[You] ' : `[${opponentShortLabel}] `;
        } else if (isPlayer) {
          textColor = 'text-blue-400';
          prefix = '[You] ';
        } else if (isOpponent) {
          textColor = 'text-red-400';
          prefix = currentCompetitionOpponent ? `[${opponentShortLabel}] ` : '[Opponent] ';
        } else if (isBoth) {
          textColor = 'text-purple-400';
          prefix = '[Both] ';
        }

        return (
          <div key={entry.id || i} className={`pb-2 border-b border-zinc-900 ${textColor}`}>
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
      showNotice(`No monsters in ${targetPlayer === 'player' ? 'your' : "opponent's"} Graveyard!`, 'No Target');
      return;
    }

    setUiState({
      type: 'SELECT_ZONE_CARD',
      title: `Select a monster from ${targetPlayer === 'player' ? 'your' : "opponent's"} Graveyard`,
      description: 'Choose the card you want to Special Summon with Monster Reborn.',
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
      message: 'You have a card that can respond to this action. Do you want to activate it now?',
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
        showNotice('You cannot discard the spell you are activating!', 'Invalid Action');
        return;
      }
      setUiState({ 
        type: 'SELECT_SPELL_TARGET', 
        spellCard: uiState.spellCard, 
        discardInstanceId: card.instanceId,
        fromZone: uiState.fromZone 
      });
      showNotice('Select a monster to destroy.', 'Action Required');
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
          showNotice('Selected materials do not match the required Fusion Materials!', 'Invalid Selection');
          setUiState({ ...uiState, selectedMaterials: [] });
          return;
        }

        // Check if there will be an empty zone
        const willHaveEmptyZone = state.player.monsterZone.some((m, i) => m === null || newSelected.includes(m.instanceId));
        if (!willHaveEmptyZone) {
          showNotice('No empty monster zones available for the Fusion Monster!', 'No Open Zone');
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
      showNotice(`No legal actions available for ${card.name} right now.`, 'Unavailable');
      return;
    }

    setUiState({ type: 'SELECT_HAND_CARD', card });
  };

  const beginSpellActivation = (card: GameCard, fromZone?: number) => {
    if (!canActivateCard(card, playerActivationContext, fromZone)) {
      showNotice(`${card.name} cannot be activated right now.`, 'Unavailable');
      setUiState({ type: 'IDLE' });
      return;
    }

    if (card.id === 'tribute-to-the-doomed') {
      if (state.player.hand.length < (fromZone === undefined ? 2 : 1)) {
        showNotice(fromZone === undefined ? 'You need another card to discard!' : 'You need a card to discard!', 'Action Required');
        setUiState({ type: 'IDLE' });
        return;
      }

      const hasOpponentMonsters = state.opponent.monsterZone.some(m => m !== null);
      const hasPlayerMonsters = state.player.monsterZone.some(m => m !== null);
      if (!hasOpponentMonsters && !hasPlayerMonsters) {
        showNotice('No monsters to destroy!', 'No Target');
        setUiState({ type: 'IDLE' });
        return;
      }

      setUiState({ type: 'SELECT_DISCARD', spellCard: card, fromZone });
      showNotice('Select a card to discard.', 'Action Required');
      return;
    }

    if (card.id === 'monster-reborn') {
      const hasMonstersInGy = state.player.graveyard.some(c => c.type === 'Monster') || state.opponent.graveyard.some(c => c.type === 'Monster');
      if (!hasMonstersInGy) {
        showNotice('No monsters in Graveyard!', 'No Target');
        setUiState({ type: 'IDLE' });
        return;
      }

      const hasEmptyZone = state.player.monsterZone.some(z => z === null);
      if (!hasEmptyZone) {
        showNotice('No empty monster zones!', 'No Open Zone');
        setUiState({ type: 'IDLE' });
        return;
      }

      setUiState({ type: 'SELECT_SPELL_TARGET', spellCard: card, fromZone });
      showNotice('Select a monster from either Graveyard.', 'Action Required');
      return;
    }

    if (card.id === 'brain-control') {
      if (state.player.lp < 800) {
        showNotice('You need at least 800 LP to activate Brain Control!', 'Unavailable');
        setUiState({ type: 'IDLE' });
        return;
      }

      const hasTargetableMonster = state.opponent.monsterZone.some(m => m !== null && m.position !== 'set-monster');
      if (!hasTargetableMonster) {
        showNotice('No opponent face-up monsters to take control of!', 'No Target');
        setUiState({ type: 'IDLE' });
        return;
      }

      const hasEmptyZone = state.player.monsterZone.some(z => z === null);
      if (!hasEmptyZone) {
        showNotice('No empty monster zones!', 'No Open Zone');
        setUiState({ type: 'IDLE' });
        return;
      }

      setUiState({ type: 'SELECT_SPELL_TARGET', spellCard: card, fromZone });
      showNotice("Select an opponent's face-up monster to take control of.", 'Action Required');
      return;
    }

    if (card.id === 'de-spell') {
      const hasSpellTrapTarget = state.opponent.spellTrapZone.some(c => c !== null);
      if (!hasSpellTrapTarget) {
        showNotice("No opponent Spell/Trap cards to target!", 'No Target');
        setUiState({ type: 'IDLE' });
        return;
      }

      setUiState({ type: 'SELECT_SPELL_TARGET', spellCard: card, fromZone });
      showNotice("Select an opponent's Spell/Trap card.", 'Action Required');
      return;
    }

    if (card.id === 'polymerization') {
      const possibleFusions = getPossibleFusionMonsters(state.player);
      if (possibleFusions.length === 0) {
        showNotice('You do not have the materials for any Fusion Monster!', 'Unavailable');
        setUiState({ type: 'IDLE' });
        return;
      }

      setUiState({ type: 'SELECT_FUSION_MONSTER', possibleFusions, spellInstanceId: card.instanceId, fromZone });
      showNotice('Select a Fusion Monster to summon.', 'Action Required');
      return;
    }

    dispatch({ type: 'ACTIVATE_SPELL', player: 'player', cardInstanceId: card.instanceId, fromZone });
    setUiState({ type: 'IDLE' });
  };

  const beginTrapActivation = (card: GameCard, fromZone: number) => {
    if (!canActivateSetCard(card, playerActivationContext)) {
      showNotice(`${card.name} cannot be activated right now.`, 'Unavailable');
      setUiState({ type: 'IDLE' });
      return;
    }

    if (card.id === 'dust-tornado') {
      const hasOpponentST = state.opponent.spellTrapZone.some(c => c !== null);
      if (!hasOpponentST) {
        showNotice('No opponent Spell/Trap cards to destroy!', 'No Target');
        setUiState({ type: 'IDLE' });
        return;
      }

      setUiState({ type: 'SELECT_SPELL_TARGET', spellCard: card, fromZone });
      showNotice("Select an opponent's Spell/Trap card to destroy.", 'Action Required');
      return;
    }

    showNotice('This trap card cannot be activated manually!', 'Unavailable');
  };

  const executeHandAction = (action: 'summon' | 'set' | 'activate') => {
    if (uiState.type !== 'SELECT_HAND_CARD') return;
    const card = uiState.card;
    const availableActions = getHandCardActionAvailability(card, playerActivationContext);
    
    if (card.type === 'Monster') {
      if ((action === 'summon' && !availableActions.summon) || (action === 'set' && !availableActions.setMonster)) {
        showNotice(`${card.name} cannot be ${action === 'summon' ? 'Summoned' : 'Set'} right now.`, 'Unavailable');
        setUiState({ type: 'IDLE' });
        return;
      }
      if (state.normalSummonUsed) {
        showNotice('You already Normal Summoned or Set this turn!', 'Unavailable');
        setUiState({ type: 'IDLE' });
        return;
      }
      const level = card.level || 4;
      const tributesNeeded = level >= 7 ? 2 : level >= 5 ? 1 : 0;
      const position = action === 'summon' ? 'attack' : 'set-monster';
      
      if (tributesNeeded > 0) {
        const availableTributes = state.player.monsterZone.filter(m => m !== null).length;
        if (availableTributes < tributesNeeded) {
          showNotice('Not enough monsters to tribute!', 'Unavailable');
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
          showNotice('No open Spell or Trap Zone to set this card.', 'No Open Zone');
          setUiState({ type: 'IDLE' });
          return;
        }
        dispatch({ type: 'SET_SPELL_TRAP', player: 'player', cardInstanceId: card.instanceId });
        setUiState({ type: 'IDLE' });
      } else if (action === 'activate' && card.type === 'Spell') {
        if (!availableActions.activate) {
          showNotice(`${card.name} cannot be activated right now.`, 'Unavailable');
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
        showNotice('Select a monster from a Graveyard!', 'Invalid Target');
        return;
      }
      if (uiState.spellCard.id === 'dust-tornado' || uiState.spellCard.id === 'de-spell' || uiState.spellCard.id === 'brain-control') {
        showNotice(
          uiState.spellCard.id === 'brain-control' ? "Select an opponent's face-up monster!" : "Select an opponent's Spell/Trap card!",
          'Invalid Target',
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
          showNotice('Selected materials do not match the required Fusion Materials!', 'Invalid Selection');
          setUiState({ ...uiState, selectedMaterials: [] });
          return;
        }

        // Check if there will be an empty zone
        const willHaveEmptyZone = state.player.monsterZone.some((m, i) => m === null || newSelected.includes(m.instanceId));
        if (!willHaveEmptyZone) {
          showNotice('No empty monster zones available for the Fusion Monster!', 'No Open Zone');
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
      showNotice("Select an opponent's monster to attack.", 'Action Required');
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
        showNotice('Select a monster from a Graveyard!', 'Invalid Target');
        return;
      }
      if (uiState.spellCard.id === 'dust-tornado' || uiState.spellCard.id === 'de-spell') {
        showNotice("Select an opponent's Spell/Trap card!", 'Invalid Target');
        return;
      }
      const target = state.opponent.monsterZone[index];
      if (uiState.spellCard.id === 'brain-control' && target && (target.position === 'set-monster' || target.isFusion)) {
        showNotice('Brain Control can only target a face-up monster that can be Normal Summoned or Set!', 'Invalid Target');
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
        showNotice('Invalid target!', 'Invalid Target');
        return;
      }
      openMonsterRebornZoneSelection('player', uiState.spellCard, uiState.fromZone);
    }
  };

  const handleOpponentGyClick = () => {
    if (state.turn !== 'player') return;
    if (uiState.type === 'SELECT_SPELL_TARGET') {
      if (uiState.spellCard.id !== 'monster-reborn') {
        showNotice('Invalid target!', 'Invalid Target');
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

  return (
    <>
      {view === 'start' && (
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
              <div className="text-center text-sm sm:text-base font-mono uppercase tracking-[0.35em] text-zinc-400">
                Duel Engine
              </div>
              <h1 className="mt-5 text-center text-3xl sm:text-5xl font-mono uppercase tracking-[0.32em] text-white">
                Ready For A Duel
              </h1>
              <div className="mt-4 text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">
                {userProfile ? `Signed in as ${userProfile.displayName}` : 'Guest Mode'}
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
                className="border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white hover:border-zinc-600 px-6 py-4 font-mono text-sm uppercase tracking-[0.25em] transition-colors"
              >
                CPU Mode
              </motion.button>

              <motion.button 
                onClick={startCompetitionMode} 
                whileTap={{ scale: reduced ? 1 : 0.99 }}
                className="border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white hover:border-zinc-600 px-6 py-4 font-mono text-sm uppercase tracking-[0.25em] transition-colors"
              >
                Competition Mode
              </motion.button>
              
              <div className="h-px w-full bg-zinc-800 my-3"></div>
              
              <motion.button 
                onClick={() => setView('deck-builder')} 
                whileTap={{ scale: reduced ? 1 : 0.99 }}
                className="border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white hover:border-zinc-600 px-6 py-4 font-mono text-sm uppercase tracking-[0.25em] transition-colors"
              >
                Deck Builder
              </motion.button>

              <motion.button 
                onClick={() => setView('how-to-play')} 
                whileTap={{ scale: reduced ? 1 : 0.99 }}
                className="border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white hover:border-zinc-600 px-6 py-4 font-mono text-sm uppercase tracking-[0.25em] transition-colors"
              >
                How to Play
              </motion.button>

              <motion.button 
                onClick={() => setView('history')} 
                whileTap={{ scale: reduced ? 1 : 0.99 }}
                className="border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white hover:border-zinc-600 px-6 py-4 font-mono text-sm uppercase tracking-[0.25em] transition-colors"
              >
                Game History
              </motion.button>

              <motion.button 
                onClick={() => void handleHomeAuthAction()} 
                whileTap={{ scale: reduced ? 1 : 0.99 }}
                className="border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white hover:border-zinc-600 px-6 py-4 font-mono text-sm uppercase tracking-[0.25em] transition-colors"
              >
                {userProfile ? 'Logout' : 'Sign In'}
              </motion.button>
            </motion.div>
          </motion.div>

          <AnimatePresence>
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
                      setShowAuthPrompt(false);
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
                  className="w-full max-w-xl border border-zinc-700 bg-black p-6 flex flex-col gap-5"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="text-center">
                    <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">
                      Competition Mode
                    </div>
                    <h2 className="mt-3 text-2xl font-mono uppercase tracking-[0.18em] text-white">
                      Ladder Progress
                    </h2>
                    <p className="mt-2 text-xs font-mono uppercase tracking-[0.18em] text-zinc-500">
                      Current Stage: {competitionResumeOpponent.stage} / {competitionResumeOpponent.totalStages}
                    </p>
                  </div>
                  <div className="border border-zinc-800 bg-zinc-950/70 px-4 py-4">
                    <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">
                      Next Opponent
                    </div>
                    <div className="mt-2 text-lg font-mono uppercase tracking-[0.15em] text-white">
                      {competitionResumeOpponent.name}
                    </div>
                    <div className="mt-3 text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">
                      Cleared: {Math.max(0, competitionResumeOpponent.stage - 1)} / {competitionResumeOpponent.totalStages}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {competitionResumeOpponent.signatureCardIds.map((cardId) => (
                      <div key={cardId} className="border border-zinc-800 bg-zinc-950 px-3 py-3 text-center">
                        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">Signature</div>
                        <div className="mt-2 text-[11px] font-mono uppercase tracking-[0.12em] text-white">
                          {buildCompetitionPreviewCard(cardId).name}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3">
                    <button
                      onClick={() => void startCompetitionDuel(competitionResumeStageIndex)}
                      className="border border-zinc-600 hover:bg-white hover:text-black text-white px-4 py-3 font-mono text-sm uppercase tracking-widest transition-colors"
                    >
                      {competitionResumeStageIndex > 0 ? 'Resume Ladder' : 'Begin Ladder'}
                    </button>
                    {competitionResumeStageIndex > 0 && (
                      <button
                        onClick={() => {
                          void clearCompetitionProgress().then(() => {
                            setCompetitionResumeStageIndex(0);
                            void startCompetitionDuel(0);
                          });
                        }}
                        className="border border-zinc-800 hover:border-zinc-600 hover:text-white text-zinc-500 px-4 py-3 font-mono text-sm uppercase tracking-widest transition-colors"
                      >
                        Restart From Stage 1
                      </button>
                    )}
                    <button
                      onClick={() => setShowCompetitionLobby(false)}
                      className="text-xs font-mono uppercase tracking-widest text-zinc-500 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {view === 'deck-builder' && (
        <Suspense fallback={renderLazyScreenFallback('Deck Builder')}>
          <DeckBuilder onBack={() => setView('start')} announce={showAnnouncement} />
        </Suspense>
      )}
      {view === 'how-to-play' && (
        <Suspense fallback={renderLazyScreenFallback('How To Play')}>
          <HowToPlay onBack={() => setView('start')} />
        </Suspense>
      )}
      {view === 'sign-in' && (
        <Suspense fallback={renderLazyScreenFallback('Sign In')}>
          <SignInPage
            onBack={() => setView('start')}
            onSuccess={() => setView('start')}
          />
        </Suspense>
      )}
      {view === 'history' && (
        <Suspense fallback={renderLazyScreenFallback('Game History')}>
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
        <div className="h-dvh md:h-screen box-border overflow-hidden bg-black text-white font-sans flex flex-col md:flex-row pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:p-0">
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
                  Stage {currentCompetitionOpponent.stage} of {currentCompetitionOpponent.totalStages}: {currentCompetitionOpponent.name}
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
                      <div className="text-zinc-700 font-mono text-[9px] tracking-widest">GY</div>
                    )}
                  </div>
                  <div className="h-16 rounded border border-zinc-800 bg-zinc-900 flex items-center justify-center" title="Main Deck">
                    <div className="text-zinc-600 font-mono text-[9px] tracking-widest text-center">DECK<br/>({state.opponent.deck.length})</div>
                  </div>
                  <div className="h-16 rounded border border-zinc-800 bg-zinc-900 flex items-center justify-center" title="Extra Deck">
                    <div className="text-zinc-600 font-mono text-[9px] tracking-widest text-center">EXTRA<br/>({state.opponent.extraDeck.length})</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Opponent Hand</span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">{state.opponent.hand.length} Cards</span>
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
                <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Opponent Field</div>
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
                <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Current Phase</div>
                <div className="text-sm font-mono text-white mt-1">{state.phase}</div>
                <div className="text-[10px] font-mono text-zinc-600 mt-1">{getPhaseInstruction(state.phase, state.turn)}</div>
              </div>
              <button
                onClick={handleNextPhase}
                disabled={state.turn !== 'player' || state.phase === 'DP'}
                className="shrink-0 border border-zinc-700 px-4 py-3 font-mono text-xs uppercase tracking-widest text-white disabled:text-zinc-600 disabled:border-zinc-800 hover:bg-white hover:text-black transition-colors flex items-center gap-2"
              >
                Next
                <ArrowRight size={16} />
              </button>
            </section>

            <section className="rounded border border-zinc-800 bg-zinc-950/70 p-3 space-y-3">
              <div className="space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Your Field</div>
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
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Your Hand</span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">{state.player.hand.length} Cards</span>
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
                      <div className="text-zinc-700 font-mono text-[9px] tracking-widest">GY</div>
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
                <button onClick={() => setUiState({ type: 'IDLE' })} className="text-xs font-mono text-zinc-500 hover:text-white mt-2 uppercase tracking-widest">Cancel</button>
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
                <span>SELECT {uiState.count} TRIBUTE(S)</span>
                <button onClick={() => setUiState({ type: 'IDLE' })} className="text-xs font-mono text-zinc-500 hover:text-white uppercase tracking-widest">Cancel</button>
              </div>
            </motion.div>
          )}
          {uiState.type === 'SELECT_DISCARD' && (
            <div className="absolute inset-x-0 top-16 md:top-20 z-50 flex justify-center p-4 pointer-events-none">
              <div className="bg-black/95 p-4 rounded border border-zinc-700 text-white font-mono text-sm tracking-widest flex flex-col items-center gap-3 pointer-events-auto shadow-2xl">
                <span>SELECT A CARD TO DISCARD</span>
                <button onClick={() => setUiState({ type: 'IDLE' })} className="text-xs font-mono text-zinc-500 hover:text-white uppercase tracking-widest">Cancel</button>
              </div>
            </div>
          )}
          {uiState.type === 'SELECT_SPELL_TARGET' && (
            <div className="absolute inset-x-0 top-16 md:top-20 z-50 flex justify-center p-4 pointer-events-none">
              <div className="bg-black/95 p-4 rounded border border-zinc-700 text-white font-mono text-sm tracking-widest flex flex-col items-center gap-3 pointer-events-auto shadow-2xl max-w-[90vw] text-center">
                <span>SELECT A TARGET FOR {uiState.spellCard.name.toUpperCase()}</span>
                <button onClick={() => setUiState({ type: 'IDLE' })} className="text-xs font-mono text-zinc-500 hover:text-white uppercase tracking-widest">Cancel</button>
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
                  <button onClick={() => setUiState({ type: 'IDLE' })} className="text-xs font-mono text-zinc-500 hover:text-white uppercase tracking-widest">Cancel</button>
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
                <span>SELECT A FUSION MONSTER</span>
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
                      showNotice(`Select materials for ${fm.name}.`, 'Action Required');
                    }}>
                      <CardView 
                        card={fm} 
                        onMouseEnter={() => setShowCardDetail(fm)}
                        onMouseLeave={() => setShowCardDetail(null)}
                      />
                    </div>
                  ))}
                </div>
                <button onClick={() => setUiState({ type: 'IDLE' })} className="text-xs font-mono text-zinc-500 hover:text-white uppercase tracking-widest mt-4">Cancel</button>
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
                <span>SELECT MATERIALS FOR {uiState.fusionMonster.name.toUpperCase()}</span>
                <span className="text-sm text-zinc-400">Selected: {uiState.selectedMaterials.length} / {uiState.fusionMonster.fusionMaterials?.length || 0}</span>
                <button onClick={() => setUiState({ type: 'IDLE' })} className="text-xs font-mono text-zinc-500 hover:text-white uppercase tracking-widest">Cancel</button>
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
                    CPU Mode
                  </div>
                  <h2 className="text-xl font-sans font-bold uppercase tracking-wide text-white mb-2">
                    Select Deck Type
                  </h2>
                  <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-6">
                    Choose how you want to duel the CPU.
                  </p>
                  <div className="w-full flex flex-col gap-3">
                    <button
                      onClick={startRandomGame}
                      className="border border-zinc-600 hover:bg-white hover:text-black text-white px-4 py-3 font-mono text-sm uppercase tracking-widest transition-colors"
                    >
                      Random Deck
                    </button>
                    <button
                      onClick={startCustomGame}
                      className="border border-zinc-600 hover:bg-white hover:text-black text-white px-4 py-3 font-mono text-sm uppercase tracking-widest transition-colors"
                    >
                      Custom Deck
                    </button>
                    <button
                      onClick={returnToMenu}
                      className="text-xs font-mono uppercase tracking-widest text-zinc-500 hover:text-white mt-2"
                    >
                      Cancel
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
                    Stage {currentCompetitionOpponent.stage} of {currentCompetitionOpponent.totalStages}
                  </div>
                  <h2 className="text-3xl font-mono uppercase tracking-[0.16em] text-white">
                    {currentCompetitionOpponent.name}
                  </h2>
                  <p className="max-w-md text-base text-zinc-200 leading-7">
                    {currentCompetitionOpponent.voice.intro}
                  </p>
                  <div className="pt-1">
                    <button
                      onClick={() => setShowCompetitionIntro(false)}
                      className="border border-zinc-600 hover:bg-white hover:text-black text-white px-6 py-3 font-mono text-sm uppercase tracking-widest transition-colors"
                    >
                      Begin Duel
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
                        Stage {currentCompetitionOpponent.stage} of {currentCompetitionOpponent.totalStages}
                      </div>
                      <h1 className="mt-3 text-5xl font-mono tracking-[0.18em] text-white uppercase">
                        {state.winner === 'player' ? 'Victory' : 'Defeat'}
                      </h1>
                      <div className="mt-3 text-sm font-mono uppercase tracking-[0.16em] text-zinc-500">
                        {state.winner === 'player'
                          ? `Stage cleared: ${currentCompetitionOpponent.name}`
                          : `Eliminated by ${currentCompetitionOpponent.name}`}
                      </div>
                    </div>
                    {(() => {
                      const summary = getCompetitionSummaryStats();
                      if (!summary) return null;
                      return (
                        <>
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="border border-zinc-800 bg-zinc-950 px-4 py-4">
                              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">Turns</div>
                              <div className="mt-2 text-lg font-mono text-white">{summary.turnsSurvived}</div>
                            </div>
                            <div className="border border-zinc-800 bg-zinc-950 px-4 py-4">
                              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">LP Remaining</div>
                              <div className="mt-2 text-lg font-mono text-white">{summary.lpRemaining}</div>
                            </div>
                            <div className="border border-zinc-800 bg-zinc-950 px-4 py-4">
                              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">Finish</div>
                              <div className="mt-2 text-sm font-mono uppercase tracking-[0.12em] text-white">
                                {summary.finishingCard ?? 'Duel End'}
                              </div>
                            </div>
                          </div>
                          <div className="border border-zinc-800 bg-zinc-950 px-4 py-4 text-left">
                            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">Summary</div>
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
                        ? (competitionStageIndex !== null && competitionStageIndex < COMPETITION_LADDER.length - 1 ? 'Next Duel' : 'Claim Title')
                        : 'Return To Menu'}
                    </button>
                  </div>
                ) : (
                  <div className="text-center flex flex-col items-center gap-8">
                    <h1 className="text-6xl font-sans tracking-widest text-white uppercase">
                      {state.winner === 'player' ? 'VICTORY' : 'DEFEAT'}
                    </h1>
                    <button
                      onClick={returnToMenu}
                      className="border border-zinc-600 hover:bg-white hover:text-black text-white px-8 py-3 font-mono text-sm transition-colors"
                    >
                      Play Again
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
            {renderCardDetailPanel('Hover card for details')}
          </div>

          <div className="h-1/2 p-4 flex flex-col shrink-0">
            <h3 className="text-zinc-500 font-mono uppercase tracking-widest text-[10px] mb-4">Duel Log</h3>
            {renderDuelLogPanel()}
          </div>
        </div>

        {/* Mobile Info Panel */}
        <div className={`md:hidden bg-zinc-950 border-t border-zinc-800 flex flex-col shrink-0 overflow-hidden transition-[height] duration-200 ${mobileInfoExpanded ? 'h-[34vh] min-h-[220px]' : 'h-[53px]'}`}>
          <div className="grid grid-cols-[1fr_1fr_auto] border-b border-zinc-800 shrink-0">
            <button
              onClick={() => handleMobileInfoTabChange('details')}
              className={`px-4 py-3 text-[10px] font-mono uppercase tracking-[0.3em] transition-colors ${mobileInfoTab === 'details' ? 'bg-black text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}
            >
              Card Info
            </button>
            <button
              onClick={() => handleMobileInfoTabChange('log')}
              className={`px-4 py-3 text-[10px] font-mono uppercase tracking-[0.3em] transition-colors ${mobileInfoTab === 'log' ? 'bg-black text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}
            >
              Duel Log
            </button>
            <button
              onClick={() => setMobileInfoExpanded((prev) => !prev)}
              className="flex items-center justify-center border-l border-zinc-800 px-3 text-zinc-500 hover:bg-zinc-900 hover:text-white transition-colors"
              aria-label={mobileInfoExpanded ? 'Collapse mobile info panel' : 'Expand mobile info panel'}
            >
              {mobileInfoExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
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
                className="flex-1 overflow-y-auto p-4"
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
                      {renderMobileCardDetailPanel('Tap a face-up card, hand card, or graveyard pile to inspect it')}
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
                      {renderDuelLogPanel()}
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


