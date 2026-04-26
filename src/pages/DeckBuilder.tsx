import React, { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MobileBottomSheet } from '../components/mobile/MobileBottomSheet';
import { CARD_DB } from '../constants';
import { CardView } from '../components/CardView';
import { Card } from '../types';
import { ArrowLeft, Search, Plus, Save, Layers, X, Trash2, Star, Sparkles } from 'lucide-react';
import { getSharedTransition, useMotionPreference } from '../utils/motion';
import type { AnnouncementInput } from '../hooks/useAnnouncementQueue';
import { getCardSupportMeta } from '../effects/registry';
import { CHARACTER_DECKS } from '../utils/characterDecks';
import { getCurrentUser } from '../services/auth';
import { requestDeckAssistant } from '../services/deckAssistant';
import { getUserDeckState, saveUserDeckState, setPrimaryDeckSelection } from '../services/userData';
import type { SavedDeck } from '../types/cloud';
import type { DeckAssistantResponse } from '../types/assistant';
import { useAppPreferences } from '../preferences/AppPreferencesProvider';
import {
  getCardSubtypeTranslationKey,
  getCardTypeTranslationKey,
  getLocalizedCardText,
  getLocalizedSupportStatusKey,
} from '../services/cardLocalization';

export default function DeckBuilder({
  onBack,
  announce = () => {},
  embeddedInShell = false,
}: {
  onBack: () => void;
  announce?: (input: AnnouncementInput) => void;
  embeddedInShell?: boolean;
}) {
  const { t, language } = useAppPreferences();
  const { reduced } = useMotionPreference();
  const [decks, setDecks] = useState<SavedDeck[]>([]);
  const [primaryDeckId, setPrimaryDeckId] = useState<string>('');
  const [editingDeckId, setEditingDeckId] = useState<string>('');
  const [deckName, setDeckName] = useState<string>('');
  const [deck, setDeck] = useState<string[]>([]);
  const [extraDeck, setExtraDeck] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Monster' | 'Spell' | 'Trap' | 'Fusion'>('All');
  const [sortBy, setSortBy] = useState<string>('name-asc');
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null);
  const [isDeckView, setIsDeckView] = useState(false);
  const [mobileCardSheetOpen, setMobileCardSheetOpen] = useState(false);
  const [mobileDeckSheetOpen, setMobileDeckSheetOpen] = useState(false);
  const [mobileAssistantSheetOpen, setMobileAssistantSheetOpen] = useState(false);
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const [desktopLowerTab, setDesktopLowerTab] = useState<'decks' | 'assistant'>('decks');
  const [syncStatus, setSyncStatus] = useState<'loading' | 'local' | 'syncing' | 'synced' | 'error'>('loading');
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [assistantPrompt, setAssistantPrompt] = useState('Improve consistency and reduce unsupported cards.');
  const [assistantStatus, setAssistantStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantResult, setAssistantResult] = useState<DeckAssistantResponse | null>(null);
  const hoveredSupportMeta = hoveredCard ? getCardSupportMeta(hoveredCard) : null;
  const localizedHoveredCard = hoveredCard ? getLocalizedCardText(hoveredCard, language) : null;
  const syncStatusLabel =
    syncStatus === 'loading'
      ? t('syncStatusLoading')
      : syncStatus === 'syncing'
        ? t('syncStatusSyncing')
        : syncStatus === 'synced'
          ? t('syncStatusSynced')
          : syncStatus === 'error'
            ? t('syncStatusError')
            : t('syncStatusLocal');

  const allCards = useMemo(() => Object.values(CARD_DB), [decks.length]);

  const filteredAndSortedCards = useMemo(() => {
    let filtered = allCards.filter(card => {
      const searchValue = search.toLowerCase();
      const searchableText = [
        getLocalizedCardText(card, language).name,
        getLocalizedCardText(card, language).description,
        card.monsterTypeLine,
        card.monsterRace,
        card.spellTrapProperty,
        ...(card.monsterAbilities ?? []),
        ...(card.supports ?? []),
        ...(card.antiSupports ?? []),
        ...(card.cardActions ?? []),
        ...(card.effectTypes ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = searchableText.includes(searchValue);
      let matchesType = false;
      if (filterType === 'All') matchesType = true;
      else if (filterType === 'Monster') matchesType = card.type === 'Monster' && !card.isFusion;
      else if (filterType === 'Fusion') matchesType = !!card.isFusion;
      else matchesType = card.type === filterType;
      
      return matchesSearch && matchesType;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'level-desc') return (b.level || 0) - (a.level || 0);
      if (sortBy === 'level-asc') return (a.level || 0) - (b.level || 0);
      if (sortBy === 'atk-desc') return (b.atk || 0) - (a.atk || 0);
      if (sortBy === 'def-desc') return (b.def || 0) - (a.def || 0);
      if (sortBy === 'type') {
        const typeA = a.subType || '';
        const typeB = b.subType || '';
        return typeA.localeCompare(typeB);
      }
      return 0;
    });

    return filtered;
  }, [allCards, search, filterType, sortBy, language]);

  const deckCards = useMemo(() => {
    return deck.map(id => CARD_DB[id]).filter(Boolean);
  }, [deck]);

  const extraDeckCards = useMemo(() => {
    return extraDeck.map(id => CARD_DB[id]).filter(Boolean);
  }, [extraDeck]);

  useEffect(() => {
    if (!isDeckView || hoveredCard) return;
    setHoveredCard(deckCards[0] || extraDeckCards[0] || null);
  }, [isDeckView, hoveredCard, deckCards, extraDeckCards]);

  useEffect(() => {
    if (!embeddedInShell || !hoveredCard) return;
    setMobileCardSheetOpen(true);
  }, [embeddedInShell, hoveredCard]);

  const isCurrentPredefined = useMemo(() => {
    return decks.find(d => d.id === editingDeckId)?.isPredefined || false;
  }, [decks, editingDeckId]);

  useEffect(() => {
    const bootstrap = async () => {
      setSyncStatus('loading');
      const [deckState, user] = await Promise.all([
        getUserDeckState(),
        getCurrentUser(),
      ]);

      const userDecks = deckState.decks.filter((entry) => !entry.isPredefined);
      const combinedDecks = [...userDecks, ...CHARACTER_DECKS];
      const selectedDeckId = deckState.primaryDeckId || combinedDecks[0]?.id || '';
      const selectedDeck = combinedDecks.find((entry) => entry.id === selectedDeckId) || combinedDecks[0];

      setDecks(combinedDecks);
      setPrimaryDeckId(selectedDeckId);
      setEditingDeckId(selectedDeck?.id || '');
      setDeckName(selectedDeck?.name || '');
      setDeck(selectedDeck?.mainDeck || []);
      setExtraDeck(selectedDeck?.extraDeck || []);
      setCurrentUserEmail(user?.email ?? null);
      setSyncStatus(user ? 'synced' : 'local');
    };

    void bootstrap();
  }, []);

  const handleAddCard = (id: string) => {
    if (isCurrentPredefined) {
      announce({ title: t('deckBuilder'), message: t('cannotModifyPredefinedDecks') });
      return;
    }

    const card = CARD_DB[id];
    if (!card) return;

    if (card.isFusion) {
      if (extraDeck.length >= 15) {
        announce({ title: t('deckBuilder'), message: t('extraDeckLimit') });
        return;
      }
      const count = extraDeck.filter(c => c === id).length;
      if (count >= 3) {
        announce({ title: t('deckBuilder'), message: t('maxThreeCopies') });
        return;
      }
      setExtraDeck([...extraDeck, id]);
    } else {
      if (deck.length >= 60) {
        announce({ title: t('deckBuilder'), message: t('mainDeckCannotExceed60') });
        return;
      }
      const count = deck.filter(c => c === id).length;
      if (count >= 3) {
        announce({ title: t('deckBuilder'), message: t('maxThreeCopies') });
        return;
      }
      setDeck([...deck, id]);
    }
  };

  const handleRemoveCard = (id: string, isFusion: boolean) => {
    if (isCurrentPredefined) {
      announce({ title: t('deckBuilder'), message: t('cannotModifyPredefinedDecks') });
      return;
    }

    if (isFusion) {
      const index = extraDeck.indexOf(id);
      if (index > -1) {
        const newDeck = [...extraDeck];
        newDeck.splice(index, 1);
        setExtraDeck(newDeck);
      }
    } else {
      const index = deck.indexOf(id);
      if (index > -1) {
        const newDeck = [...deck];
        newDeck.splice(index, 1);
        setDeck(newDeck);
      }
    }
  };

  const handleSave = () => {
    if (isCurrentPredefined) {
      announce({ title: t('deckBuilder'), message: t('cannotSavePredefinedDecks') });
      return;
    }

    if (deck.length < 40) {
      announce({ title: t('deckBuilder'), message: t('mainDeckMinimum40') });
      return;
    }

    const persist = async () => {
      setSyncStatus(currentUserEmail ? 'syncing' : 'local');
      const updatedUserDecks = decks
        .filter((entry) => !entry.isPredefined)
        .map((entry) =>
          entry.id === editingDeckId
            ? { ...entry, name: deckName, mainDeck: deck, extraDeck, updatedAt: new Date().toISOString() }
            : entry,
        );

      await saveUserDeckState({
        decks: updatedUserDecks,
        primaryDeckId,
        primaryDeckUpdatedAt: new Date().toISOString(),
      });

      setDecks([...updatedUserDecks, ...CHARACTER_DECKS]);
      setSyncStatus(currentUserEmail ? 'synced' : 'local');
      announce({ title: t('deckBuilder'), message: t('deckBuilderSaved') });
    };

    void persist().catch(() => {
      setSyncStatus('error');
      announce({ title: t('deckBuilder'), message: t('deckBuilderSaveFailed') });
    });
  };

  const handleCreateDeck = () => {
    const newDeck: SavedDeck = {
      id: Date.now().toString(),
      name: t('newDeckName', {
        index: decks.filter((entry) => !entry.isPredefined).length + 1,
      }),
      mainDeck: [],
      extraDeck: [],
      kind: 'user',
      characterId: null,
      updatedAt: new Date().toISOString(),
    };
    const updatedUserDecks = [...decks.filter((entry) => !entry.isPredefined), newDeck];
    setDecks([...updatedUserDecks, ...CHARACTER_DECKS]);
    setEditingDeckId(newDeck.id);
    setDeckName(newDeck.name);
    setDeck(newDeck.mainDeck);
    setExtraDeck(newDeck.extraDeck);
  };

  const handleSwitchDeck = (id: string) => {
    const d = decks.find(d => d.id === id);
    if (d) {
      setEditingDeckId(d.id);
      setDeckName(d.name);
      setDeck(d.mainDeck);
      setExtraDeck(d.extraDeck);
    }
  };

  const handleSetPrimary = (id: string) => {
    setPrimaryDeckId(id);

    const persist = async () => {
      const updatedUserDecks = decks
        .filter((entry) => !entry.isPredefined)
        .map((entry) =>
          entry.id === editingDeckId && !entry.isPredefined
            ? { ...entry, name: deckName, mainDeck: deck, extraDeck, updatedAt: new Date().toISOString() }
            : entry,
        );

      await saveUserDeckState({
        decks: updatedUserDecks,
        primaryDeckId: id,
        primaryDeckUpdatedAt: new Date().toISOString(),
      });
      await setPrimaryDeckSelection(id);
      setDecks([...updatedUserDecks, ...CHARACTER_DECKS]);
      const selectedDeck = [...updatedUserDecks, ...CHARACTER_DECKS].find((entry) => entry.id === id);
      announce({ title: t('deckBuilder'), message: t('primaryDeckSet', { name: selectedDeck?.name || t('decks') }) });
      setSyncStatus(currentUserEmail ? 'synced' : 'local');
    };

    setSyncStatus(currentUserEmail ? 'syncing' : 'local');
    void persist().catch(() => {
      setSyncStatus('error');
      announce({ title: t('deckBuilder'), message: t('primaryDeckUpdateFailed') });
    });
  };
  
  const handleDeleteDeck = (id: string) => {
    if (decks.length <= 1) {
      announce({ title: t('deckBuilder'), message: t('atLeastOneDeckRequired') });
      return;
    }
    
    const updatedDecks = decks.filter(d => d.id !== id);
    setDecks(updatedDecks);

    void saveUserDeckState({
      decks: updatedDecks.filter((entry) => !entry.isPredefined),
      primaryDeckId: primaryDeckId === id ? updatedDecks[0].id : primaryDeckId,
      primaryDeckUpdatedAt: new Date().toISOString(),
    }).catch(() => {
      setSyncStatus('error');
    });
    
    if (primaryDeckId === id) {
      handleSetPrimary(updatedDecks[0].id);
    }
    
    if (editingDeckId === id) {
      handleSwitchDeck(updatedDecks[0].id);
    }
  };

  const handleToggleDeckView = () => {
    setIsDeckView(prev => !prev);
  };

  const handleHoveredCardAction = () => {
    if (!hoveredCard) return;

    if (isDeckView) {
      handleRemoveCard(hoveredCard.id, !!hoveredCard.isFusion);
      return;
    }

    handleAddCard(hoveredCard.id);
  };

  const handleAssistantRequest = async () => {
    setAssistantStatus('loading');
    setAssistantError(null);

    try {
      const result = await requestDeckAssistant({
        deckName,
        mainDeck: deck,
        extraDeck,
        prompt: assistantPrompt,
        cardPool: allCards.map((card) => ({
          id: card.id,
          name: card.name,
          type: card.type,
          description: getLocalizedCardText(card, language).description,
        })),
        supportMatrix: allCards.map((card) => ({
          id: card.id,
          name: card.name,
          support: getCardSupportMeta(card),
        })),
      });

      setAssistantResult(result);
      setAssistantStatus('done');
    } catch (assistantRequestError) {
      setAssistantStatus('error');
      setAssistantError(
        assistantRequestError instanceof Error
          ? assistantRequestError.message
          : t('deckAssistantRequestFailed'),
      );
    }
  };

  const renderDeckList = (variant: 'desktop' | 'mobile-sheet' = 'desktop') => (
    <div className={`${variant === 'desktop' ? 'flex-1 overflow-y-auto p-4' : 'max-h-[52vh] overflow-y-auto'} flex flex-col gap-2`}>
      {decks.map((d) => (
        <div
          key={d.id}
          className={`p-3 rounded border flex flex-col gap-2 transition-colors ${editingDeckId === d.id ? 'border-white bg-zinc-900' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600 cursor-pointer'}`}
          onClick={() => {
            if (editingDeckId !== d.id) handleSwitchDeck(d.id);
          }}
        >
          <div className="flex items-center justify-between">
            {editingDeckId === d.id && !d.isPredefined ? (
              <input
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                className="bg-transparent border-b border-zinc-700 text-white font-mono text-xs uppercase tracking-widest focus:outline-none focus:border-white w-full mr-2"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="font-mono text-xs uppercase tracking-widest text-zinc-300 truncate pr-2">{d.name}</span>
            )}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); handleSetPrimary(d.id); }}
                className={`transition-colors ${primaryDeckId === d.id ? 'text-yellow-500' : 'text-zinc-600 hover:text-yellow-500'}`}
                title={primaryDeckId === d.id ? t('primaryDeckTooltip') : t('primaryDeckTooltip')}
              >
                <Star size={14} fill={primaryDeckId === d.id ? 'currentColor' : 'none'} />
              </button>
              {decks.length > 1 && !d.isPredefined && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteDeck(d.id); }}
                  className="text-zinc-600 hover:text-red-500 transition-colors"
                  title={t('deckDelete')}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 flex justify-between">
            <span>{t('mainLabel')}: {editingDeckId === d.id ? deck.length : d.mainDeck.length}</span>
            <span>{t('extraLabel')}: {editingDeckId === d.id ? extraDeck.length : d.extraDeck.length}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderAssistantPanel = (variant: 'desktop' | 'mobile-sheet' = 'desktop') => (
    <div className={`${variant === 'desktop' ? 'flex-1 overflow-y-auto p-4' : 'max-h-[56vh] overflow-y-auto'} flex flex-col gap-4`}>
      <div className="theme-eyebrow text-[10px]">
        {t('summary')}
      </div>
      <textarea
        value={assistantPrompt}
        onChange={(event) => setAssistantPrompt(event.target.value)}
        rows={4}
        className="theme-input w-full rounded-none px-4 py-3 text-xs"
        placeholder={t('assistantPromptPlaceholder')}
      />
      <button
        onClick={() => void handleAssistantRequest()}
        disabled={assistantStatus === 'loading' || deck.length === 0}
        className="theme-button disabled:border-[var(--app-border)] disabled:text-[var(--app-text-dim)] disabled:cursor-not-allowed px-4 py-3 font-mono text-xs uppercase tracking-widest flex items-center justify-center gap-2"
      >
        <Sparkles size={14} />
        {assistantStatus === 'loading' ? t('analyzing') : t('analyzeDeck')}
      </button>

      {assistantError && <div className="text-sm text-red-400">{assistantError}</div>}

      {assistantResult ? (
        <div className="space-y-4">
          <div className="border border-zinc-800 bg-zinc-950 px-4 py-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500 mb-2">{t('summary')}</div>
            <div className="text-sm text-zinc-300 leading-6">{assistantResult.summary}</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border border-zinc-800 bg-zinc-950 px-4 py-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500 mb-2">{t('strengths')}</div>
              <div className="space-y-2 text-sm text-zinc-300">
                {assistantResult.strengths.map((item) => <div key={item}>- {item}</div>)}
              </div>
            </div>
            <div className="border border-zinc-800 bg-zinc-950 px-4 py-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500 mb-2">{t('weaknesses')}</div>
              <div className="space-y-2 text-sm text-zinc-300">
                {assistantResult.weaknesses.map((item) => <div key={item}>- {item}</div>)}
              </div>
            </div>
          </div>
          <div className="border border-zinc-800 bg-zinc-950 px-4 py-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500 mb-2">{t('suggestedChanges')}</div>
            <div className="space-y-3">
              {assistantResult.suggestions.map((suggestion, index) => {
                const card = CARD_DB[suggestion.cardId];
                return (
                  <div key={`${suggestion.cardId}-${index}`} className="text-sm text-zinc-300">
                    <span className="font-mono uppercase tracking-[0.16em] text-white">{suggestion.action}</span>
                    <span className="ml-2 text-white">{card?.name || suggestion.cardId}</span>
                    <div className="mt-1 text-zinc-400 leading-5">{suggestion.reason}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-zinc-600 text-xs font-mono uppercase tracking-widest">
          {t('assistantEmptyState')}
        </div>
      )}
    </div>
  );

  return (
    <div className={`${embeddedInShell ? 'theme-screen flex h-full min-h-0 flex-col overflow-hidden' : 'theme-screen h-dvh md:h-screen box-border overflow-hidden font-sans flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:p-0'}`}>
      {!embeddedInShell && (
      <div className="theme-screen theme-divider h-14 md:h-12 border-b flex items-center justify-between px-3 md:px-6 z-10 shrink-0 gap-3">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <button 
            onClick={onBack}
            className="theme-subtle hover:text-[var(--app-text-primary)] transition-colors flex items-center gap-2 font-mono text-xs uppercase tracking-widest"
          >
            <ArrowLeft size={14} /> {t('back')}
          </button>
          <div className="theme-divider h-4 w-px mx-2"></div>
          <div className="hidden sm:flex flex-col">
            <h1 className="theme-eyebrow text-xs">{t('deckBuilder')}</h1>
            <div className="theme-subtle text-[9px] font-mono uppercase tracking-[0.22em]">
              {currentUserEmail ? `${syncStatusLabel} | ${currentUserEmail}` : t('localOnly')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <button 
            onClick={handleToggleDeckView}
            className="theme-button flex items-center gap-2 px-3 md:px-4 py-2 text-[10px] md:text-xs font-mono uppercase tracking-widest"
          >
            <Layers size={14} /> 
            <span className="hidden sm:inline">{isDeckView ? t('cards') : t('deckView')}</span>
            <span className={deck.length < 40 || deck.length > 60 ? 'text-red-400 ml-1' : 'ml-1'}>
              ({deck.length}/60)
            </span>
          </button>
          <button 
            onClick={handleSave}
            disabled={isCurrentPredefined}
            className={`flex items-center gap-2 border px-3 md:px-4 py-2 text-[10px] md:text-xs font-mono uppercase tracking-widest transition-colors ${
              isCurrentPredefined 
                ? 'border-[var(--app-border)] text-[var(--app-text-dim)] cursor-not-allowed' 
                : 'theme-button'
            }`}
          >
            <Save size={14} /> <span className="hidden sm:inline">{t('save')}</span>
          </button>
        </div>
      </div>
      )}

      {embeddedInShell && (
        <div className="theme-screen theme-divider border-b px-3 py-3">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <div className="theme-eyebrow text-[9px]">{t('deckBuilder')}</div>
              <div className="theme-title mt-1 text-[12px] uppercase tracking-[0.04em] truncate">{deckName}</div>
              <div className="theme-subtle mt-1 text-[8px] font-mono uppercase tracking-[0.12em]">
                {currentUserEmail ? `${syncStatusLabel} | ${currentUserEmail}` : t('localOnly')}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setMobileDeckSheetOpen(true)}
                className="theme-button-subtle rounded-[8px] px-2 py-1 text-[7px] font-mono uppercase tracking-[0.08em]"
              >
                {t('decks')}
              </button>
              <button
                type="button"
                onClick={() => setMobileAssistantSheetOpen(true)}
                className="theme-button-subtle rounded-[8px] px-2 py-1 text-[7px] font-mono uppercase tracking-[0.08em]"
              >
                AI
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isCurrentPredefined}
                className={`rounded-[8px] border px-2 py-1 text-[7px] font-mono uppercase tracking-[0.08em] ${
                  isCurrentPredefined ? 'border-[var(--app-border)] text-[var(--app-text-dim)]' : 'theme-button'
                }`}
              >
                {t('save')}
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <div className="theme-elevated grid grid-cols-2 rounded-[10px] p-0.5">
              <button
                type="button"
                onClick={() => setIsDeckView(false)}
                className={`rounded-[6px] px-2 py-1 text-[7px] font-mono uppercase tracking-[0.08em] ${!isDeckView ? 'theme-chip-active' : 'theme-chip'}`}
              >
                {t('library')}
              </button>
              <button
                type="button"
                onClick={() => setIsDeckView(true)}
                className={`rounded-[6px] px-2 py-1 text-[7px] font-mono uppercase tracking-[0.08em] ${isDeckView ? 'theme-chip-active' : 'theme-chip'}`}
              >
                {t('currentDeck')}
              </button>
            </div>
            <div className={`rounded-[8px] border px-2 py-1 text-[7px] font-mono uppercase tracking-[0.08em] ${deck.length < 40 || deck.length > 60 ? 'border-red-500 text-red-400' : 'border-[var(--app-border)] text-[var(--app-text-muted)]'}`}>
              {deck.length}/60
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden min-h-0">
        {/* Card Pool */}
        <div className="theme-screen theme-divider flex-1 flex flex-col border-r overflow-hidden">
          {isDeckView ? (
            <div className="theme-screen theme-divider p-4 border-b flex items-center justify-between shrink-0">
              <div>
                <div className="theme-title text-xs uppercase tracking-widest">{t('currentDeck')}</div>
                <div className="theme-subtle text-[10px] font-mono mt-1">
                  {t('mainLabel')}: {deck.length} / 60
                  {extraDeck.length > 0 && <span className="ml-3">{t('extraLabel')}: {extraDeck.length} / 15</span>}
                </div>
              </div>
              <div className="theme-subtle text-[10px] font-mono uppercase tracking-widest">
                {t('tapCardsForDetails')}
              </div>
            </div>
          ) : (
            <div className="theme-screen theme-divider p-3 border-b flex flex-wrap gap-2.5 shrink-0">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="theme-subtle absolute left-3 top-1/2 -translate-y-1/2" size={14} />
                <input 
                  type="text" 
                  placeholder={t('searchCards')} 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="theme-input w-full rounded-none pl-9 pr-4 py-2 text-[9px] font-mono transition-colors"
                />
              </div>
              <select 
                value={filterType}
                onChange={e => {
                  setFilterType(e.target.value as any);
                  setSortBy('name-asc');
                }}
                className="theme-input rounded-none px-4 py-2 text-[9px] font-mono transition-colors uppercase tracking-[0.08em]"
              >
                <option value="All">{t('allTypes')}</option>
                <option value="Monster">{t('cardTypeMonster')}</option>
                <option value="Spell">{t('cardTypeSpell')}</option>
                <option value="Trap">{t('cardTypeTrap')}</option>
                <option value="Fusion">{t('fusionType')}</option>
              </select>
              <select 
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="theme-input rounded-none px-4 py-2 text-[9px] font-mono transition-colors uppercase tracking-[0.08em]"
              >
                <option value="name-asc">{t('nameSortAsc')}</option>
                <option value="name-desc">{t('nameSortDesc')}</option>
                {(filterType === 'Monster' || filterType === 'All' || filterType === 'Fusion') && (
                  <>
                    <option value="level-desc">{t('sortLevelDesc')}</option>
                    <option value="level-asc">{t('sortLevelAsc')}</option>
                    <option value="atk-desc">{t('sortAtkDesc')}</option>
                    <option value="def-desc">{t('sortDefDesc')}</option>
                  </>
                )}
                {(filterType === 'Spell' || filterType === 'Trap') && (
                  <option value="type">{t('sortCardType')}</option>
                )}
              </select>
            </div>
          )}
          
          {/* Scrollable Grid */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <AnimatePresence mode="wait" initial={false}>
              {isDeckView ? (
                <motion.div
                  key="deck-view"
                  initial={{ opacity: 0, x: reduced ? 0 : 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reduced ? 0 : -8 }}
                  transition={getSharedTransition(reduced, 'fast')}
                  className="h-full"
                >
                  {deckCards.length === 0 && extraDeckCards.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-zinc-600 font-mono text-sm uppercase tracking-widest">
                      {t('yourDeckIsEmpty')}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-8">
                  <div>
                    <div className="flex justify-between items-end mb-4 border-b border-zinc-800 pb-2">
                      <h3 className="text-lg font-mono text-white uppercase tracking-widest">{t('mainDeck')}</h3>
                      <span className="text-xs font-mono text-zinc-500">{deck.length} / 60</span>
                    </div>
                    {deckCards.length === 0 ? (
                      <div className="text-zinc-600 font-mono text-xs uppercase tracking-widest py-4">
                        {t('mainDeckEmpty')}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 sm:gap-4">
                        {deckCards.map((card, index) => (
                          <div key={`${card.id}-${index}`} className="flex justify-center">
                            <div 
                              className="relative cursor-pointer transition-transform hover:scale-105"
                              onClick={() => setHoveredCard(card as any)}
                            >
                              <CardView card={card as any} />
                              {!isCurrentPredefined && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveCard(card.id, false);
                                  }}
                                  className="absolute -top-2 -right-2 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-red-900 w-5 h-5 rounded-full flex items-center justify-center border border-zinc-700 z-10 transition-colors shadow-md"
                                >
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {extraDeckCards.length > 0 && (
                    <div>
                      <div className="flex justify-between items-end mb-4 border-b border-zinc-800 pb-2">
                        <h3 className="text-lg font-mono text-zinc-400 uppercase tracking-widest">{t('extraDeck')}</h3>
                        <span className="text-xs font-mono text-zinc-500">{extraDeck.length} / 15</span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 sm:gap-4">
                        {extraDeckCards.map((card, index) => (
                          <div key={`${card.id}-${index}`} className="flex justify-center">
                            <div 
                              className="relative cursor-pointer transition-transform hover:scale-105"
                              onClick={() => setHoveredCard(card as any)}
                            >
                              <CardView card={card as any} />
                              {!isCurrentPredefined && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveCard(card.id, true);
                                  }}
                                  className="absolute -top-2 -right-2 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-red-900 w-5 h-5 rounded-full flex items-center justify-center border border-zinc-700 z-10 transition-colors shadow-md"
                                >
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                    </div>
                  )}
                </motion.div>
            ) : (
              <motion.div
                key="library-view"
                initial={{ opacity: 0, x: reduced ? 0 : -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reduced ? 0 : 8 }}
                transition={getSharedTransition(reduced, 'fast')}
                className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 sm:gap-4"
              >
                {filteredAndSortedCards.map(card => {
                  const countInDeck = card.isFusion 
                    ? extraDeck.filter(id => id === card.id).length 
                    : deck.filter(id => id === card.id).length;
                  
                  return (
                    <div key={card.id} className="flex justify-center">
                      <div 
                        className="relative cursor-pointer transition-transform hover:scale-105"
                        onClick={() => setHoveredCard(card as any)}
                      >
                        <CardView card={card as any} />
                        {countInDeck > 0 && (
                          <div className={`absolute -top-2 -right-2 text-white text-[10px] font-mono w-5 h-5 rounded-full flex items-center justify-center border z-10 shadow-md ${card.isFusion ? 'bg-purple-900 border-purple-500' : 'bg-zinc-800 border-zinc-500'}`}>
                            {countInDeck}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Sidebar: Card Details & Decks */}
        <div className="w-80 bg-zinc-950 border-l border-zinc-800 flex-col shrink-0 hidden md:flex">
          {/* Card Details Section */}
          <div className="h-1/2 flex flex-col border-b border-zinc-800">
            <div className="p-4 border-b border-zinc-800 flex justify-center items-center shrink-0">
              <h2 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{t('cardDetails')}</h2>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <AnimatePresence mode="wait" initial={false}>
              {hoveredCard ? (
                <motion.div
                  key={`${hoveredCard.id}-${isDeckView ? 'deck' : 'library'}-desktop`}
                  initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -8 }}
                  transition={getSharedTransition(reduced, 'fast')}
                  className="w-full h-full flex flex-col"
                >
                  <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
                    <div className="w-full max-w-[220px] rounded border border-zinc-700 p-4 flex flex-col bg-black">
                      <div className="font-sans text-xl font-bold leading-tight mb-2 text-white uppercase tracking-wider">{localizedHoveredCard?.name ?? hoveredCard.name}</div>
                      <div className="text-[10px] font-mono text-zinc-500 mb-4 uppercase tracking-widest border-b border-zinc-800 pb-2 flex justify-between">
                        <span>[{t(getCardTypeTranslationKey(hoveredCard.type))}{hoveredCard.subType ? ` / ${t(getCardSubtypeTranslationKey(hoveredCard.subType) || 'cardTypeNormal')}` : ''}]</span>
                        {hoveredCard.type === 'Monster' && (
                          <span>LVL {hoveredCard.level} {hoveredCard.level! >= 7 ? `(${t('helpTwoTributes')})` : hoveredCard.level! >= 5 ? `(${t('helpOneTribute')})` : ''}</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 font-sans leading-relaxed">
                        {localizedHoveredCard?.description ?? hoveredCard.description}
                      </div>
                      {hoveredSupportMeta && (hoveredCard.type !== 'Monster' || hoveredSupportMeta.status !== 'implemented') && (
                        <div className="mt-4 pt-3 border-t border-zinc-800 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                          <div className="text-zinc-400">{t(getLocalizedSupportStatusKey(hoveredSupportMeta.status))}</div>
                          {hoveredSupportMeta.note && (
                            <div className="mt-1 normal-case tracking-normal text-zinc-500">
                              {hoveredSupportMeta.note}
                            </div>
                          )}
                        </div>
                      )}
                      {hoveredCard.type === 'Monster' && (
                        <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between font-mono text-sm text-zinc-300">
                          <span>ATK {hoveredCard.atk}</span>
                          <span>DEF {hoveredCard.def}</span>
                        </div>
                      )}
                      {hoveredCard.isFusion && hoveredCard.fusionMaterials && (
                        <div className="mt-4 border-t border-zinc-800 pt-3">
                          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">{t('fusionMaterials')}</div>
                          <div className="mt-1 text-[11px] text-zinc-300 leading-5">{hoveredCard.fusionMaterials.join(' + ')}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 px-6 py-4">
                    <div className="w-full max-w-[220px] mx-auto flex flex-col gap-2">
                    <button 
                      onClick={handleHoveredCardAction}
                      disabled={isCurrentPredefined}
                      className={`w-full border px-4 py-3 font-mono text-sm transition-colors uppercase tracking-widest flex items-center justify-center gap-2 ${
                        isCurrentPredefined
                          ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
                          : 'border-zinc-600 hover:bg-white hover:text-black text-white'
                      }`}
                    >
                      {isDeckView ? <X size={16} /> : <Plus size={16} />}
                      {isDeckView
                        ? t('removeFromDeck', { zone: hoveredCard.isFusion ? t('extraDeck') : t('mainDeck') })
                        : t('addToDeck', { zone: hoveredCard.isFusion ? t('extraDeck') : t('mainDeck') })}
                    </button>
                    <div className="text-center text-xs font-mono text-zinc-500 mt-2">
                      {t('inDeck', {
                        zone: hoveredCard.isFusion ? t('extraDeck') : t('mainDeck'),
                        count: hoveredCard.isFusion ? extraDeck.filter(id => id === hoveredCard.id).length : deck.filter(id => id === hoveredCard.id).length,
                      })}
                    </div>
                  </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty-desktop-card"
                  initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -6 }}
                  transition={getSharedTransition(reduced, 'fast')}
                  className="flex-1 flex items-center justify-center text-zinc-600 text-xs font-mono uppercase tracking-widest text-center px-6"
                >
                  {t('clickCardForDetails')}
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          </div>

          {/* Decks Section */}
          <div className="h-1/2 flex flex-col bg-black">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center shrink-0 gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDesktopLowerTab('decks')}
                  className={`text-[10px] font-mono uppercase tracking-widest transition-colors ${desktopLowerTab === 'decks' ? 'text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                  {t('decks')}
                </button>
                <button
                  onClick={() => setDesktopLowerTab('assistant')}
                  className={`text-[10px] font-mono uppercase tracking-widest transition-colors ${desktopLowerTab === 'assistant' ? 'text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                  {t('aiAssist')}
                </button>
              </div>
              <button
                onClick={handleCreateDeck}
                className="text-zinc-400 hover:text-white transition-colors"
                title={t('createNewDeck')}
              >
                <Plus size={16} />
              </button>
            </div>
            {desktopLowerTab === 'decks' ? renderDeckList() : renderAssistantPanel()}
          </div>
        </div>

        {!embeddedInShell && (
          <div className="md:hidden border-t border-zinc-800 bg-zinc-950 px-4 py-3 text-center text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">
            {t('tapCardToInspect')}
          </div>
        )}
      </div>

      {embeddedInShell && (
        <>
          <MobileBottomSheet
            open={mobileCardSheetOpen && Boolean(hoveredCard)}
            onClose={() => setMobileCardSheetOpen(false)}
            title={t('cardDetails')}
            expandable
            expanded={mobileSheetExpanded}
            onToggleExpanded={() => setMobileSheetExpanded((previous) => !previous)}
            compactHeightClassName="max-h-[56vh]"
            maxHeightClassName="max-h-[84vh]"
          >
            {hoveredCard ? (
              <div className="space-y-4 pb-2">
                <div className="rounded-2xl border border-zinc-800 bg-black">
                  <div className="border-b border-zinc-800 px-4 py-4">
                    <div className="text-xl font-sans font-bold leading-tight text-white uppercase tracking-wide">
                      {localizedHoveredCard?.name ?? hoveredCard.name}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-400">
                      <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                        {t(getCardTypeTranslationKey(hoveredCard.type))}
                        {hoveredCard.subType ? ` / ${t(getCardSubtypeTranslationKey(hoveredCard.subType) || 'cardTypeNormal')}` : ''}
                      </span>
                      {hoveredCard.type === 'Monster' ? (
                        <>
                          <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                            Lvl {hoveredCard.level}
                          </span>
                          <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-500">
                            {hoveredCard.level! >= 7 ? t('helpTwoTributes') : hoveredCard.level! >= 5 ? t('helpOneTribute') : t('helpNoTributes')}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="px-4 py-4 space-y-4">
                    {hoveredCard.type === 'Monster' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3">
                          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">ATK</div>
                          <div className="mt-2 text-base font-mono text-white">{hoveredCard.atk}</div>
                        </div>
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3">
                          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">DEF</div>
                          <div className="mt-2 text-base font-mono text-white">{hoveredCard.def}</div>
                        </div>
                      </div>
                    ) : null}

                    <div className="text-sm leading-7 text-zinc-300">
                      {localizedHoveredCard?.description ?? hoveredCard.description}
                    </div>

                    {hoveredSupportMeta && (hoveredCard.type !== 'Monster' || hoveredSupportMeta.status !== 'implemented') ? (
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-2">
                          {t(getLocalizedSupportStatusKey(hoveredSupportMeta.status))}
                        </div>
                        {hoveredSupportMeta.note ? (
                          <div className="text-[11px] leading-5 text-zinc-300">{hoveredSupportMeta.note}</div>
                        ) : null}
                      </div>
                    ) : null}

                    {hoveredCard.isFusion && hoveredCard.fusionMaterials ? (
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-2">
                          {t('fusionMaterials')}
                        </div>
                        <div className="text-[11px] leading-5 text-zinc-300">
                          {hoveredCard.fusionMaterials.join(' + ')}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="sticky bottom-0 space-y-2 border-t border-zinc-800 bg-zinc-950 pt-4">
                  <button 
                    onClick={handleHoveredCardAction}
                    disabled={isCurrentPredefined}
                    className={`w-full rounded-2xl border px-4 py-3 font-mono text-sm transition-colors uppercase tracking-[0.18em] flex items-center justify-center gap-2 ${
                      isCurrentPredefined ? 'border-zinc-800 text-zinc-600 cursor-not-allowed' : 'border-zinc-600 text-white'
                    }`}
                  >
                    {isDeckView ? <X size={16} /> : <Plus size={16} />}
                    {isDeckView
                      ? t('removeFromDeck', { zone: hoveredCard.isFusion ? t('extraDeck') : t('mainDeck') })
                      : t('addToDeck', { zone: hoveredCard.isFusion ? t('extraDeck') : t('mainDeck') })}
                  </button>
                  <div className="text-center text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                    {t('inDeck', {
                      zone: hoveredCard.isFusion ? t('extraDeck') : t('mainDeck'),
                      count: hoveredCard.isFusion ? extraDeck.filter(id => id === hoveredCard.id).length : deck.filter(id => id === hoveredCard.id).length,
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </MobileBottomSheet>

          <MobileBottomSheet
            open={mobileDeckSheetOpen}
            onClose={() => setMobileDeckSheetOpen(false)}
            title={t('decks')}
            expandable
            expanded={mobileSheetExpanded}
            onToggleExpanded={() => setMobileSheetExpanded((previous) => !previous)}
            compactHeightClassName="max-h-[56vh]"
            maxHeightClassName="max-h-[84vh]"
          >
            <div className="space-y-4 pb-2">
              <button
                type="button"
                onClick={handleCreateDeck}
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-300"
              >
                {t('createDeck')}
              </button>
              {renderDeckList('mobile-sheet')}
            </div>
          </MobileBottomSheet>

          <MobileBottomSheet
            open={mobileAssistantSheetOpen}
            onClose={() => setMobileAssistantSheetOpen(false)}
            title={t('aiAssist')}
            expandable
            expanded={mobileSheetExpanded}
            onToggleExpanded={() => setMobileSheetExpanded((previous) => !previous)}
            compactHeightClassName="max-h-[56vh]"
            maxHeightClassName="max-h-[84vh]"
          >
            <div className="pb-2">
              {renderAssistantPanel('mobile-sheet')}
            </div>
          </MobileBottomSheet>
        </>
      )}
    </div>
  );
}
