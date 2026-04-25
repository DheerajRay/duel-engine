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

export default function DeckBuilder({
  onBack,
  announce = () => {},
  embeddedInShell = false,
}: {
  onBack: () => void;
  announce?: (input: AnnouncementInput) => void;
  embeddedInShell?: boolean;
}) {
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

  const allCards = useMemo(() => Object.values(CARD_DB), [decks.length]);

  const filteredAndSortedCards = useMemo(() => {
    let filtered = allCards.filter(card => {
      const searchValue = search.toLowerCase();
      const searchableText = [
        card.name,
        card.description,
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
  }, [allCards, search, filterType, sortBy]);

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
      announce({ title: 'Deck Builder', message: 'Cannot modify predefined character decks. Please create a new custom deck.' });
      return;
    }

    const card = CARD_DB[id];
    if (!card) return;

    if (card.isFusion) {
      if (extraDeck.length >= 15) {
        announce({ title: 'Deck Builder', message: 'Extra Deck cannot exceed 15 cards.' });
        return;
      }
      const count = extraDeck.filter(c => c === id).length;
      if (count >= 3) {
        announce({ title: 'Deck Builder', message: 'You can only have up to 3 copies of a card.' });
        return;
      }
      setExtraDeck([...extraDeck, id]);
    } else {
      if (deck.length >= 60) {
        announce({ title: 'Deck Builder', message: 'Main Deck cannot exceed 60 cards.' });
        return;
      }
      const count = deck.filter(c => c === id).length;
      if (count >= 3) {
        announce({ title: 'Deck Builder', message: 'You can only have up to 3 copies of a card.' });
        return;
      }
      setDeck([...deck, id]);
    }
  };

  const handleRemoveCard = (id: string, isFusion: boolean) => {
    if (isCurrentPredefined) {
      announce({ title: 'Deck Builder', message: 'Cannot modify predefined character decks. Please create a new custom deck.' });
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
      announce({ title: 'Deck Builder', message: 'Cannot save predefined character decks.' });
      return;
    }

    if (deck.length < 40) {
      announce({ title: 'Deck Builder', message: 'Main Deck must have at least 40 cards.' });
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
      announce({ title: 'Deck Builder', message: 'Deck saved successfully.' });
    };

    void persist().catch(() => {
      setSyncStatus('error');
      announce({ title: 'Deck Builder', message: 'Deck save failed. Your local deck remains unchanged.' });
    });
  };

  const handleCreateDeck = () => {
    const newDeck: SavedDeck = {
      id: Date.now().toString(),
      name: `New Deck ${decks.filter((entry) => !entry.isPredefined).length + 1}`,
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
      announce({ title: 'Deck Builder', message: `${selectedDeck?.name || 'Deck'} set as primary deck.` });
      setSyncStatus(currentUserEmail ? 'synced' : 'local');
    };

    setSyncStatus(currentUserEmail ? 'syncing' : 'local');
    void persist().catch(() => {
      setSyncStatus('error');
      announce({ title: 'Deck Builder', message: 'Could not update the primary deck.' });
    });
  };
  
  const handleDeleteDeck = (id: string) => {
    if (decks.length <= 1) {
      announce({ title: 'Deck Builder', message: 'You must have at least one deck.' });
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
          description: card.description,
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
          : 'Deck assistant request failed.',
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
                title={primaryDeckId === d.id ? 'Primary Deck' : 'Set as Primary'}
              >
                <Star size={14} fill={primaryDeckId === d.id ? 'currentColor' : 'none'} />
              </button>
              {decks.length > 1 && !d.isPredefined && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteDeck(d.id); }}
                  className="text-zinc-600 hover:text-red-500 transition-colors"
                  title="Delete Deck"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 flex justify-between">
            <span>Main: {editingDeckId === d.id ? deck.length : d.mainDeck.length}</span>
            <span>Extra: {editingDeckId === d.id ? extraDeck.length : d.extraDeck.length}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderAssistantPanel = (variant: 'desktop' | 'mobile-sheet' = 'desktop') => (
    <div className={`${variant === 'desktop' ? 'flex-1 overflow-y-auto p-4' : 'max-h-[56vh] overflow-y-auto'} flex flex-col gap-4`}>
      <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">
        Suggest + explain
      </div>
      <textarea
        value={assistantPrompt}
        onChange={(event) => setAssistantPrompt(event.target.value)}
        rows={4}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-none px-4 py-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        placeholder="Make this deck more aggressive. Reduce unsupported cards."
      />
      <button
        onClick={() => void handleAssistantRequest()}
        disabled={assistantStatus === 'loading' || deck.length === 0}
        className="border border-zinc-600 hover:bg-white hover:text-black text-white disabled:border-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed px-4 py-3 font-mono text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
      >
        <Sparkles size={14} />
        {assistantStatus === 'loading' ? 'Analyzing...' : 'Analyze Deck'}
      </button>

      {assistantError && <div className="text-sm text-red-400">{assistantError}</div>}

      {assistantResult ? (
        <div className="space-y-4">
          <div className="border border-zinc-800 bg-zinc-950 px-4 py-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500 mb-2">Summary</div>
            <div className="text-sm text-zinc-300 leading-6">{assistantResult.summary}</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border border-zinc-800 bg-zinc-950 px-4 py-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500 mb-2">Strengths</div>
              <div className="space-y-2 text-sm text-zinc-300">
                {assistantResult.strengths.map((item) => <div key={item}>- {item}</div>)}
              </div>
            </div>
            <div className="border border-zinc-800 bg-zinc-950 px-4 py-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500 mb-2">Weaknesses</div>
              <div className="space-y-2 text-sm text-zinc-300">
                {assistantResult.weaknesses.map((item) => <div key={item}>- {item}</div>)}
              </div>
            </div>
          </div>
          <div className="border border-zinc-800 bg-zinc-950 px-4 py-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500 mb-2">Suggested Changes</div>
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
          Ask for a direction like "make this deck feel more like Kaiba" or "cut unsupported cards."
        </div>
      )}
    </div>
  );

  return (
    <div className={`${embeddedInShell ? 'flex h-full min-h-0 flex-col overflow-hidden bg-black text-white' : 'h-dvh md:h-screen box-border overflow-hidden bg-black text-white font-sans flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:p-0'}`}>
      {!embeddedInShell && (
      <div className="h-14 md:h-12 border-b border-zinc-800 flex items-center justify-between px-3 md:px-6 bg-black z-10 shrink-0 gap-3">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <button 
            onClick={onBack}
            className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 font-mono text-xs uppercase tracking-widest"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div className="h-4 w-px bg-zinc-800 mx-2"></div>
          <div className="hidden sm:flex flex-col">
            <h1 className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Deck Builder</h1>
            <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-zinc-600">
              {currentUserEmail ? `${syncStatus} | ${currentUserEmail}` : 'local only'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <button 
            onClick={handleToggleDeckView}
            className="flex items-center gap-2 border border-zinc-600 hover:bg-white hover:text-black text-white px-3 md:px-4 py-2 text-[10px] md:text-xs font-mono uppercase tracking-widest transition-colors"
          >
            <Layers size={14} /> 
            <span className="hidden sm:inline">{isDeckView ? 'Card View' : 'Deck View'}</span>
            <span className={deck.length < 40 || deck.length > 60 ? 'text-red-400 ml-1' : 'ml-1'}>
              ({deck.length}/60)
            </span>
          </button>
          <button 
            onClick={handleSave}
            disabled={isCurrentPredefined}
            className={`flex items-center gap-2 border px-3 md:px-4 py-2 text-[10px] md:text-xs font-mono uppercase tracking-widest transition-colors ${
              isCurrentPredefined 
                ? 'border-zinc-800 text-zinc-600 cursor-not-allowed' 
                : 'border-zinc-600 hover:bg-white hover:text-black text-white'
            }`}
          >
            <Save size={14} /> <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </div>
      )}

      {embeddedInShell && (
        <div className="border-b border-zinc-800 bg-black px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">Deck Builder</div>
              <div className="mt-2 text-base font-mono uppercase tracking-[0.14em] text-white truncate">{deckName}</div>
              <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                {currentUserEmail ? `${syncStatus} | ${currentUserEmail}` : 'Local only'}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setMobileDeckSheetOpen(true)}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-300"
              >
                Decks
              </button>
              <button
                type="button"
                onClick={() => setMobileAssistantSheetOpen(true)}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-300"
              >
                AI
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isCurrentPredefined}
                className={`rounded-2xl border px-3 py-3 text-[10px] font-mono uppercase tracking-[0.2em] ${
                  isCurrentPredefined ? 'border-zinc-800 text-zinc-600' : 'border-zinc-600 text-white'
                }`}
              >
                Save
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
            <div className="grid grid-cols-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-1">
              <button
                type="button"
                onClick={() => setIsDeckView(false)}
                className={`rounded-xl px-3 py-2 text-[10px] font-mono uppercase tracking-[0.2em] ${!isDeckView ? 'bg-white text-black' : 'text-zinc-500'}`}
              >
                Library
              </button>
              <button
                type="button"
                onClick={() => setIsDeckView(true)}
                className={`rounded-xl px-3 py-2 text-[10px] font-mono uppercase tracking-[0.2em] ${isDeckView ? 'bg-white text-black' : 'text-zinc-500'}`}
              >
                Current Deck
              </button>
            </div>
            <div className={`rounded-2xl border px-3 py-2 text-[10px] font-mono uppercase tracking-[0.2em] ${deck.length < 40 || deck.length > 60 ? 'border-red-500 text-red-400' : 'border-zinc-800 text-zinc-500'}`}>
              {deck.length}/60
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden min-h-0">
        {/* Card Pool */}
        <div className="flex-1 flex flex-col border-r border-zinc-800 bg-zinc-950 overflow-hidden">
          {isDeckView ? (
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-black shrink-0">
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-white">Current Deck</div>
                <div className="text-[10px] font-mono text-zinc-500 mt-1">
                  Main: {deck.length} / 60
                  {extraDeck.length > 0 && <span className="ml-3">Extra: {extraDeck.length} / 15</span>}
                </div>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
                Click cards for details
              </div>
            </div>
          ) : (
            <div className="p-4 border-b border-zinc-800 flex flex-wrap gap-4 bg-black shrink-0">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                <input 
                  type="text" 
                  placeholder="Search cards..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-none pl-9 pr-4 py-2 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>
              <select 
                value={filterType}
                onChange={e => {
                  setFilterType(e.target.value as any);
                  setSortBy('name-asc');
                }}
                className="bg-zinc-950 border border-zinc-800 rounded-none px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-zinc-500 transition-colors uppercase tracking-widest"
              >
                <option value="All">All Types</option>
                <option value="Monster">Monsters</option>
                <option value="Spell">Spells</option>
                <option value="Trap">Traps</option>
                <option value="Fusion">Fusion</option>
              </select>
              <select 
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-none px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-zinc-500 transition-colors uppercase tracking-widest"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                {(filterType === 'Monster' || filterType === 'All' || filterType === 'Fusion') && (
                  <>
                    <option value="level-desc">Level (High-Low)</option>
                    <option value="level-asc">Level (Low-High)</option>
                    <option value="atk-desc">ATK (High-Low)</option>
                    <option value="def-desc">DEF (High-Low)</option>
                  </>
                )}
                {(filterType === 'Spell' || filterType === 'Trap') && (
                  <option value="type">Card Type</option>
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
                      Your deck is empty
                    </div>
                  ) : (
                    <div className="flex flex-col gap-8">
                  <div>
                    <div className="flex justify-between items-end mb-4 border-b border-zinc-800 pb-2">
                      <h3 className="text-lg font-mono text-white uppercase tracking-widest">Main Deck</h3>
                      <span className="text-xs font-mono text-zinc-500">{deck.length} / 60</span>
                    </div>
                    {deckCards.length === 0 ? (
                      <div className="text-zinc-600 font-mono text-xs uppercase tracking-widest py-4">
                        Main deck is empty
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
                        <h3 className="text-lg font-mono text-zinc-400 uppercase tracking-widest">Extra Deck</h3>
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
              <h2 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Card Details</h2>
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
                      <div className="font-sans text-xl font-bold leading-tight mb-2 text-white uppercase tracking-wider">{hoveredCard.name}</div>
                      <div className="text-[10px] font-mono text-zinc-500 mb-4 uppercase tracking-widest border-b border-zinc-800 pb-2 flex justify-between">
                        <span>[{hoveredCard.type}{hoveredCard.subType ? ` / ${hoveredCard.subType}` : ''}]</span>
                        {hoveredCard.type === 'Monster' && (
                          <span>LVL {hoveredCard.level} {hoveredCard.level! >= 7 ? '(2 Tributes)' : hoveredCard.level! >= 5 ? '(1 Tribute)' : ''}</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 font-sans leading-relaxed">
                        {hoveredCard.description}
                      </div>
                      {hoveredSupportMeta && (hoveredCard.type !== 'Monster' || hoveredSupportMeta.status !== 'implemented') && (
                        <div className="mt-4 pt-3 border-t border-zinc-800 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                          <div className="text-zinc-400">{hoveredSupportMeta.label}</div>
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
                          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">Fusion Materials</div>
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
                      {isDeckView ? `Remove from ${hoveredCard.isFusion ? 'Extra Deck' : 'Deck'}` : `Add to ${hoveredCard.isFusion ? 'Extra Deck' : 'Deck'}`}
                    </button>
                    <div className="text-center text-xs font-mono text-zinc-500 mt-2">
                      In {hoveredCard.isFusion ? 'Extra Deck' : 'Deck'}: {hoveredCard.isFusion ? extraDeck.filter(id => id === hoveredCard.id).length : deck.filter(id => id === hoveredCard.id).length} / 3
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
                  Click card for details
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
                  Decks
                </button>
                <button
                  onClick={() => setDesktopLowerTab('assistant')}
                  className={`text-[10px] font-mono uppercase tracking-widest transition-colors ${desktopLowerTab === 'assistant' ? 'text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                  AI Assist
                </button>
              </div>
              <button
                onClick={handleCreateDeck}
                className="text-zinc-400 hover:text-white transition-colors"
                title="Create New Deck"
              >
                <Plus size={16} />
              </button>
            </div>
            {desktopLowerTab === 'decks' ? renderDeckList() : renderAssistantPanel()}
          </div>
        </div>

        {!embeddedInShell && (
          <div className="md:hidden border-t border-zinc-800 bg-zinc-950 px-4 py-3 text-center text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">
            Tap a card to inspect it, then use the mobile actions below.
          </div>
        )}
      </div>

      {embeddedInShell && (
        <>
          <MobileBottomSheet
            open={mobileCardSheetOpen && Boolean(hoveredCard)}
            onClose={() => setMobileCardSheetOpen(false)}
            title="Card Details"
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
                      {hoveredCard.name}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-400">
                      <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                        {hoveredCard.type}
                        {hoveredCard.subType ? ` / ${hoveredCard.subType}` : ''}
                      </span>
                      {hoveredCard.type === 'Monster' ? (
                        <>
                          <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                            Lvl {hoveredCard.level}
                          </span>
                          <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-500">
                            {hoveredCard.level! >= 7 ? '2 Tributes' : hoveredCard.level! >= 5 ? '1 Tribute' : 'No Tribute'}
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
                      {hoveredCard.description}
                    </div>

                    {hoveredSupportMeta && (hoveredCard.type !== 'Monster' || hoveredSupportMeta.status !== 'implemented') ? (
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-2">
                          {hoveredSupportMeta.label}
                        </div>
                        {hoveredSupportMeta.note ? (
                          <div className="text-[11px] leading-5 text-zinc-300">{hoveredSupportMeta.note}</div>
                        ) : null}
                      </div>
                    ) : null}

                    {hoveredCard.isFusion && hoveredCard.fusionMaterials ? (
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-2">
                          Fusion Materials
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
                    {isDeckView ? `Remove from ${hoveredCard.isFusion ? 'Extra Deck' : 'Deck'}` : `Add to ${hoveredCard.isFusion ? 'Extra Deck' : 'Deck'}`}
                  </button>
                  <div className="text-center text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                    In {hoveredCard.isFusion ? 'Extra Deck' : 'Deck'}: {hoveredCard.isFusion ? extraDeck.filter(id => id === hoveredCard.id).length : deck.filter(id => id === hoveredCard.id).length} / 3
                  </div>
                </div>
              </div>
            ) : null}
          </MobileBottomSheet>

          <MobileBottomSheet
            open={mobileDeckSheetOpen}
            onClose={() => setMobileDeckSheetOpen(false)}
            title="Decks"
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
                Create Deck
              </button>
              {renderDeckList('mobile-sheet')}
            </div>
          </MobileBottomSheet>

          <MobileBottomSheet
            open={mobileAssistantSheetOpen}
            onClose={() => setMobileAssistantSheetOpen(false)}
            title="AI Assist"
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
