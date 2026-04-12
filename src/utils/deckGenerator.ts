import { CARD_DB } from '../constants';

export function generateCuratedDeck(): string[] {
  const allCards = Object.values(CARD_DB);
  
  // Filter out 0 ATK/DEF monsters unless they have a specific purpose (like Kuriboh, but we'll just skip them for now to ensure a strong beatdown deck)
  const validMonsters = allCards.filter(c => c.type === 'Monster' && !c.isFusion && (c.atk || 0) > 0);
  
  // Sort monsters by ATK to get the strongest ones
  const lowMonsters = validMonsters.filter(c => (c.level || 0) <= 4).sort((a, b) => (b.atk || 0) - (a.atk || 0));
  const highMonsters = validMonsters.filter(c => (c.level || 0) >= 5).sort((a, b) => (b.atk || 0) - (a.atk || 0));
  
  // Get good spells and traps
  const implementedSpells = ['dark-hole', 'raigeki', 'fissure', 'hinotama', 'pot-of-greed', 'tribute-to-the-doomed', 'monster-reborn', 'polymerization', 'brain-control', 'de-spell', 'harpie-s-feather-duster'];
  const implementedTraps = ['dust-tornado', 'trap-hole', 'mirror-force', 'magic-cylinder', 'negate-attack'];

  const spells = allCards.filter(c => c.type === 'Spell' && implementedSpells.includes(c.id));
  const traps = allCards.filter(c => c.type === 'Trap' && implementedTraps.includes(c.id));

  const deck: string[] = [];
  const cardCounts: Record<string, number> = {};

  const addCards = (pool: any[], targetCount: number, topN?: number) => {
    if (pool.length === 0) return;
    let added = 0;
    let attempts = 0;
    const selectionPool = topN ? pool.slice(0, topN) : pool;
    
    while (added < targetCount && attempts < 1000) {
      const card = selectionPool[Math.floor(Math.random() * selectionPool.length)];
      const count = cardCounts[card.id] || 0;
      if (count < 3) {
        deck.push(card.id);
        cardCounts[card.id] = count + 1;
        added++;
      }
      attempts++;
    }
  };

  // 40 cards total
  // 18 low level monsters (pick from the top 30 strongest)
  // 6 high level monsters (pick from the top 15 strongest)
  // 10 spells
  // 6 traps

  addCards(lowMonsters, 18, 30);
  addCards(highMonsters, 6, 15);
  
  // Add some staple spells if they exist
  const staples = ['pot-of-greed', 'monster-reborn', 'dark-hole', 'raigeki', 'tribute-to-the-doomed', 'fissure', 'brain-control', 'de-spell', 'harpie-s-feather-duster', 'trap-hole', 'mirror-force', 'magic-cylinder', 'negate-attack', 'dust-tornado', 'polymerization'];
  staples.forEach(id => {
    if (CARD_DB[id] && deck.length < 35) {
      deck.push(id);
      cardCounts[id] = 1;
    }
  });

  const remainingForSpellsTraps = 40 - deck.length;
  if (traps.length > 0) {
    addCards(spells, Math.floor(remainingForSpellsTraps * 0.6));
    addCards(traps, 40 - deck.length);
  } else {
    addCards(spells, remainingForSpellsTraps);
  }

  // Fill any remaining slots just in case
  if (deck.length < 40) {
     addCards(allCards.filter(c => !c.isFusion), 40 - deck.length);
  }

  return deck;
}

export function generateCuratedExtraDeck(): string[] {
  const allCards = Object.values(CARD_DB);
  const fusionMonsters = allCards.filter(c => c.isFusion);
  
  const extraDeck: string[] = [];
  const cardCounts: Record<string, number> = {};

  // Just add some random fusion monsters up to 15
  let added = 0;
  let attempts = 0;
  
  while (added < 15 && attempts < 1000 && fusionMonsters.length > 0) {
    const card = fusionMonsters[Math.floor(Math.random() * fusionMonsters.length)];
    const count = cardCounts[card.id] || 0;
    if (count < 3) {
      extraDeck.push(card.id);
      cardCounts[card.id] = count + 1;
      added++;
    }
    attempts++;
  }

  return extraDeck;
}
