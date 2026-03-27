import React, { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CARD_DB } from '../utils/cardParser';
import { CardView } from '../components/CardView';
import { Card } from '../types';
import { ArrowLeft, Search, Plus, Save, Layers, X, Trash2, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { getSharedTransition, useMotionPreference } from '../utils/motion';
import { ensureStarterCustomDeck } from '../utils/deckStorage';
import type { AnnouncementInput } from '../hooks/useAnnouncementQueue';

export interface SavedDeck {
  id: string;
  name: string;
  mainDeck: string[];
  extraDeck: string[];
  isPredefined?: boolean;
}

import { CHARACTER_DECKS } from '../utils/characterDecks';

const getInitialDecks = (): SavedDeck[] => {
  let userDecks: SavedDeck[] = [];
  const saved = localStorage.getItem('ygo_saved_decks');
  if (saved) {
    userDecks = JSON.parse(saved).filter((d: SavedDeck) => !d.isPredefined);
  } else {
    userDecks = [ensureStarterCustomDeck()];
  }
  return [...userDecks, ...CHARACTER_DECKS];
};

export default function DeckBuilder({ onBack, announce = () => {} }: { onBack: () => void; announce?: (input: AnnouncementInput) => void }) {
  const { reduced } = useMotionPreference();
  const [decks, setDecks] = useState<SavedDeck[]>(getInitialDecks);
  const [primaryDeckId, setPrimaryDeckId] = useState<string>(() => localStorage.getItem('ygo_primary_deck_id') || getInitialDecks()[0].id);
  const [editingDeckId, setEditingDeckId] = useState<string>(() => localStorage.getItem('ygo_primary_deck_id') || getInitialDecks()[0].id);
  
  const initialEditingDeck = useMemo(() => {
    return decks.find(d => d.id === editingDeckId) || decks[0];
  }, []);

  const [deckName, setDeckName] = useState<string>(initialEditingDeck.name);
  const [deck, setDeck] = useState<string[]>(initialEditingDeck.mainDeck);
  const [extraDeck, setExtraDeck] = useState<string[]>(initialEditingDeck.extraDeck);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Monster' | 'Spell' | 'Trap' | 'Fusion'>('All');
  const [sortBy, setSortBy] = useState<string>('name-asc');
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null);
  const [isDeckView, setIsDeckView] = useState(false);
  const [mobilePanelTab, setMobilePanelTab] = useState<'details' | 'decks'>('details');
  const [mobilePanelExpanded, setMobilePanelExpanded] = useState(false);

  const allCards = useMemo(() => Object.values(CARD_DB), []);

  const filteredAndSortedCards = useMemo(() => {
    let filtered = allCards.filter(card => {
      const matchesSearch = card.name.toLowerCase().includes(search.toLowerCase()) || 
                            card.description.toLowerCase().includes(search.toLowerCase());
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

  const isCurrentPredefined = useMemo(() => {
    return decks.find(d => d.id === editingDeckId)?.isPredefined || false;
  }, [decks, editingDeckId]);

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
    
    const updatedDecks = decks.map(d => 
      d.id === editingDeckId 
        ? { ...d, name: deckName, mainDeck: deck, extraDeck: extraDeck }
        : d
    );
    
    setDecks(updatedDecks);
    localStorage.setItem('ygo_saved_decks', JSON.stringify(updatedDecks.filter(d => !d.isPredefined)));
    
    if (editingDeckId === primaryDeckId) {
      localStorage.setItem('ygo_custom_deck', JSON.stringify(deck));
      localStorage.setItem('ygo_custom_extra_deck', JSON.stringify(extraDeck));
    }
    
    announce({ title: 'Deck Builder', message: 'Deck saved successfully.' });
  };

  const handleCreateDeck = () => {
    const newDeck: SavedDeck = {
      id: Date.now().toString(),
      name: `New Deck ${decks.length + 1}`,
      mainDeck: [],
      extraDeck: []
    };
    const updatedDecks = [...decks, newDeck];
    setDecks(updatedDecks);
    localStorage.setItem('ygo_saved_decks', JSON.stringify(updatedDecks.filter(d => !d.isPredefined)));
    
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
    localStorage.setItem('ygo_primary_deck_id', id);
    
    let d = decks.find(d => d.id === id);
    if (d) {
      if (id === editingDeckId && !d.isPredefined) {
        // Save current edits
        const updatedDecks = decks.map(deckItem => 
          deckItem.id === editingDeckId 
            ? { ...deckItem, name: deckName, mainDeck: deck, extraDeck: extraDeck }
            : deckItem
        );
        setDecks(updatedDecks);
        localStorage.setItem('ygo_saved_decks', JSON.stringify(updatedDecks.filter(d => !d.isPredefined)));
        d = updatedDecks.find(deckItem => deckItem.id === id);
      }
      
      localStorage.setItem('ygo_custom_deck', JSON.stringify(d!.mainDeck));
      localStorage.setItem('ygo_custom_extra_deck', JSON.stringify(d!.extraDeck));
      announce({ title: 'Deck Builder', message: `${d!.name} set as primary deck.` });
    }
  };
  
  const handleDeleteDeck = (id: string) => {
    if (decks.length <= 1) {
      announce({ title: 'Deck Builder', message: 'You must have at least one deck.' });
      return;
    }
    
    const updatedDecks = decks.filter(d => d.id !== id);
    setDecks(updatedDecks);
    localStorage.setItem('ygo_saved_decks', JSON.stringify(updatedDecks.filter(d => !d.isPredefined)));
    
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

  const handleMobilePanelTabChange = (tab: 'details' | 'decks') => {
    if (mobilePanelTab === tab) {
      setMobilePanelExpanded((prev) => !prev);
      return;
    }

    setMobilePanelTab(tab);
    setMobilePanelExpanded(true);
  };

  return (
    <div className="h-dvh md:h-screen box-border overflow-hidden bg-black text-white font-sans flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:p-0">
      {/* Header */}
      <div className="h-14 md:h-12 border-b border-zinc-800 flex items-center justify-between px-3 md:px-6 bg-black z-10 shrink-0 gap-3">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <button 
            onClick={onBack}
            className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 font-mono text-xs uppercase tracking-widest"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div className="h-4 w-px bg-zinc-800 mx-2"></div>
          <h1 className="text-xs font-mono text-zinc-500 uppercase tracking-widest hidden sm:block">Deck Builder</h1>
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
                        <span>[{hoveredCard.type}{hoveredCard.subType ? ` / ${hoveredCard.subType}` : ''}{hoveredCard.isFusion ? ' / Fusion' : ''}]</span>
                        {hoveredCard.type === 'Monster' && (
                          <span>LVL {hoveredCard.level} {hoveredCard.level! >= 7 && !hoveredCard.isFusion ? '(2 Tributes)' : hoveredCard.level! >= 5 && !hoveredCard.isFusion ? '(1 Tribute)' : ''}</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 font-sans leading-relaxed">
                        {hoveredCard.description}
                      </div>
                      {hoveredCard.isFusion && hoveredCard.fusionMaterials && (
                        <div className="mt-4 pt-3 border-t border-zinc-800 text-xs text-purple-400 font-mono">
                          Materials: {hoveredCard.fusionMaterials.join(' + ')}
                        </div>
                      )}
                      {hoveredCard.type === 'Monster' && (
                        <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between font-mono text-sm text-zinc-300">
                          <span>ATK {hoveredCard.atk}</span>
                          <span>DEF {hoveredCard.def}</span>
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
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center shrink-0">
              <h2 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Decks</h2>
              <button 
                onClick={handleCreateDeck}
                className="text-zinc-400 hover:text-white transition-colors"
                title="Create New Deck"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {decks.map(d => (
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
                        onChange={e => setDeckName(e.target.value)}
                        className="bg-transparent border-b border-zinc-700 text-white font-mono text-xs uppercase tracking-widest focus:outline-none focus:border-white w-full mr-2"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="font-mono text-xs uppercase tracking-widest text-zinc-300 truncate pr-2">{d.name}</span>
                    )}
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleSetPrimary(d.id); }}
                        className={`transition-colors ${primaryDeckId === d.id ? 'text-yellow-500' : 'text-zinc-600 hover:text-yellow-500'}`}
                        title={primaryDeckId === d.id ? "Primary Deck" : "Set as Primary"}
                      >
                        <Star size={14} fill={primaryDeckId === d.id ? "currentColor" : "none"} />
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
          </div>
        </div>

        <div className={`md:hidden border-t border-zinc-800 bg-zinc-950 flex flex-col shrink-0 overflow-hidden transition-[height] duration-200 ${mobilePanelExpanded ? 'h-[36vh] min-h-[240px]' : 'h-[53px]'}`}>
          <div className="grid grid-cols-[1fr_1fr_auto] border-b border-zinc-800 shrink-0">
            <button
              onClick={() => handleMobilePanelTabChange('details')}
              className={`px-4 py-3 text-[10px] font-mono uppercase tracking-[0.3em] transition-colors ${mobilePanelTab === 'details' ? 'bg-black text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}
            >
              Card Details
            </button>
            <button
              onClick={() => handleMobilePanelTabChange('decks')}
              className={`px-4 py-3 text-[10px] font-mono uppercase tracking-[0.3em] transition-colors ${mobilePanelTab === 'decks' ? 'bg-black text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}
            >
              Decks
            </button>
            <button
              onClick={() => setMobilePanelExpanded((prev) => !prev)}
              className="flex items-center justify-center border-l border-zinc-800 px-3 text-zinc-500 hover:bg-zinc-900 hover:text-white transition-colors"
              aria-label={mobilePanelExpanded ? 'Collapse mobile deck panel' : 'Expand mobile deck panel'}
            >
              {mobilePanelExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {mobilePanelExpanded && (
              <motion.div
                key="mobile-deck-panel-body"
                initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : 8 }}
                transition={getSharedTransition(reduced, 'fast')}
                className="flex-1 overflow-y-auto"
              >
                <AnimatePresence mode="wait" initial={false}>
                {mobilePanelTab === 'details' ? (
                  <motion.div
                    key="mobile-details"
                    initial={{ opacity: 0, x: reduced ? 0 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: reduced ? 0 : 8 }}
                    transition={getSharedTransition(reduced, 'fast')}
                    className="h-full flex flex-col"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                    {hoveredCard ? (
                      <motion.div
                        key={`${hoveredCard.id}-${isDeckView ? 'deck' : 'library'}-mobile`}
                        initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: reduced ? 0 : -8 }}
                        transition={getSharedTransition(reduced, 'fast')}
                        className="w-full h-full flex flex-col"
                      >
                        <div className="flex-1 overflow-y-auto p-4">
                          <div className="w-full rounded border border-zinc-800 bg-black">
                            <div className="border-b border-zinc-800 px-4 py-3">
                              <div className="text-lg font-sans font-bold leading-tight text-white uppercase tracking-wide">
                                {hoveredCard.name}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-400">
                                <span className="border border-zinc-800 bg-zinc-950 px-2 py-1">
                                  {hoveredCard.type}
                                  {hoveredCard.subType ? ` / ${hoveredCard.subType}` : ''}
                                  {hoveredCard.isFusion ? ' / Fusion' : ''}
                                </span>
                                {hoveredCard.type === 'Monster' && (
                                  <span className="border border-zinc-800 bg-zinc-950 px-2 py-1">
                                    Lvl {hoveredCard.level}
                                  </span>
                                )}
                                {hoveredCard.type === 'Monster' && !hoveredCard.isFusion && (
                                  <span className="border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-500">
                                    {hoveredCard.level! >= 7 ? '2 Tributes' : hoveredCard.level! >= 5 ? '1 Tribute' : 'No Tribute'}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="px-4 py-3 space-y-3">
                              {hoveredCard.type === 'Monster' && (
                                <div className="border-t border-zinc-800 pt-3">
                                  <div className="flex items-center gap-5 font-mono text-sm uppercase tracking-[0.2em]">
                                    <span className="text-zinc-500">ATK <span className="text-white tracking-normal">{hoveredCard.atk}</span></span>
                                    <span className="text-zinc-500">DEF <span className="text-white tracking-normal">{hoveredCard.def}</span></span>
                                  </div>
                                </div>
                              )}

                              <div className="text-xs leading-6 text-zinc-300">
                                {hoveredCard.description}
                              </div>

                              {hoveredCard.isFusion && hoveredCard.fusionMaterials && (
                                <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2.5">
                                  <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
                                    Fusion Materials
                                  </div>
                                  <div className="text-[11px] text-zinc-300 leading-5">
                                    {hoveredCard.fusionMaterials.join(' + ')}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 p-4">
                        <div className="w-full flex flex-col gap-2">
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
                        </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="empty-mobile-card"
                        initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: reduced ? 0 : -6 }}
                        transition={getSharedTransition(reduced, 'fast')}
                        className="flex-1 flex items-center justify-center text-zinc-600 text-xs font-mono uppercase tracking-widest text-center px-6"
                      >
                        Tap a card for details
                      </motion.div>
                    )}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <motion.div
                    key="mobile-decks"
                    initial={{ opacity: 0, x: reduced ? 0 : 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: reduced ? 0 : -8 }}
                    transition={getSharedTransition(reduced, 'fast')}
                    className="p-4 flex flex-col gap-2"
                  >
                    {decks.map(d => (
                      <motion.div 
                        key={d.id} 
                        layout
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
                              onChange={e => setDeckName(e.target.value)}
                              className="bg-transparent border-b border-zinc-700 text-white font-mono text-xs uppercase tracking-widest focus:outline-none focus:border-white w-full mr-2"
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <span className="font-mono text-xs uppercase tracking-widest text-zinc-300 truncate pr-2">{d.name}</span>
                          )}
                          <div className="flex items-center gap-2 shrink-0">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleSetPrimary(d.id); }}
                              className={`transition-colors ${primaryDeckId === d.id ? 'text-yellow-500' : 'text-zinc-600 hover:text-yellow-500'}`}
                              title={primaryDeckId === d.id ? "Primary Deck" : "Set as Primary"}
                            >
                              <Star size={14} fill={primaryDeckId === d.id ? "currentColor" : "none"} />
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
                      </motion.div>
                    ))}
                  </motion.div>
                )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
