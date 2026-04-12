import type { DeckAssistantRequest, DeckAssistantResponse } from '../types/assistant';

export const requestDeckAssistant = async (payload: DeckAssistantRequest): Promise<DeckAssistantResponse> => {
  const response = await fetch('/api/deck-assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Deck assistant request failed.');
  }

  return response.json() as Promise<DeckAssistantResponse>;
};
