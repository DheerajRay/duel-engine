import { generateCuratedDeck } from './deckGenerator';

export interface StoredDeck {
  id: string;
  name: string;
  mainDeck: string[];
  extraDeck: string[];
  isPredefined?: boolean;
}

const STARTER_DECK_ID = '1';

export const ensureStarterCustomDeck = (): StoredDeck => {
  const savedPrimaryDeckId = localStorage.getItem('ygo_primary_deck_id');
  const savedDecks = localStorage.getItem('ygo_saved_decks');
  const savedCustomDeck = localStorage.getItem('ygo_custom_deck');
  const savedCustomExtraDeck = localStorage.getItem('ygo_custom_extra_deck');

  if (savedPrimaryDeckId && savedCustomDeck) {
    return {
      id: savedPrimaryDeckId,
      name: 'My Custom Deck',
      mainDeck: JSON.parse(savedCustomDeck),
      extraDeck: savedCustomExtraDeck ? JSON.parse(savedCustomExtraDeck) : [],
    };
  }

  if (savedDecks) {
    const parsedDecks = JSON.parse(savedDecks) as StoredDeck[];
    const firstUserDeck = parsedDecks.find((deck) => !deck.isPredefined);

    if (firstUserDeck) {
      const primaryDeckId = savedPrimaryDeckId || firstUserDeck.id;
      const primaryDeck = parsedDecks.find((deck) => deck.id === primaryDeckId && !deck.isPredefined) || firstUserDeck;

      localStorage.setItem('ygo_primary_deck_id', primaryDeck.id);
      localStorage.setItem('ygo_custom_deck', JSON.stringify(primaryDeck.mainDeck));
      localStorage.setItem('ygo_custom_extra_deck', JSON.stringify(primaryDeck.extraDeck));

      return primaryDeck;
    }
  }

  const starterDeck: StoredDeck = {
    id: STARTER_DECK_ID,
    name: 'Starter Deck',
    mainDeck: generateCuratedDeck(),
    extraDeck: [],
  };

  localStorage.setItem('ygo_saved_decks', JSON.stringify([starterDeck]));
  localStorage.setItem('ygo_primary_deck_id', starterDeck.id);
  localStorage.setItem('ygo_custom_deck', JSON.stringify(starterDeck.mainDeck));
  localStorage.setItem('ygo_custom_extra_deck', JSON.stringify(starterDeck.extraDeck));

  return starterDeck;
};
