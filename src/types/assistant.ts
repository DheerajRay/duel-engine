import type { CardSupportMeta } from '../effects/types';

export interface DeckAssistantCardSupport {
  id: string;
  name: string;
  support: CardSupportMeta;
}

export interface DeckAssistantRequest {
  deckName: string;
  mainDeck: string[];
  extraDeck: string[];
  prompt?: string;
  cardPool: {
    id: string;
    name: string;
    type: string;
    description: string;
  }[];
  supportMatrix: DeckAssistantCardSupport[];
}

export interface DeckAssistantSuggestion {
  action: 'add' | 'cut' | 'keep';
  cardId: string;
  reason: string;
}

export interface DeckAssistantResponse {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: DeckAssistantSuggestion[];
}
