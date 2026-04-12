import type { Card } from '../types';
import type { CharacterContent, CompetitionStageContent, GameContentBundle, SavedDeck } from '../types/cloud';
import { LOCAL_CARD_DB } from '../utils/cardParser';
import { LOCAL_CHARACTER_DECKS, replaceCharacterDecks } from '../utils/characterDecks';
import {
  COMPETITION_CHARACTERS,
  COMPETITION_STAGES,
  replaceCompetitionCharacters,
  replaceCompetitionStages,
} from '../utils/competitionMode';

export const CARD_DB: Record<string, Card> = Object.fromEntries(
  Object.entries(LOCAL_CARD_DB).map(([id, card]) => [id, { ...card }]),
);

export const replaceCardDb = (cards: Card[]) => {
  Object.keys(CARD_DB).forEach((key) => {
    delete CARD_DB[key];
  });

  cards.forEach((card) => {
    CARD_DB[card.id] = {
      ...card,
      fusionMaterials: card.fusionMaterials ? [...card.fusionMaterials] : undefined,
    };
  });
};

export const getLocalGameContentBundle = (): GameContentBundle => ({
  cards: Object.values(LOCAL_CARD_DB).map((card) => ({
    ...card,
    fusionMaterials: card.fusionMaterials ? [...card.fusionMaterials] : undefined,
  })),
  predefinedDecks: LOCAL_CHARACTER_DECKS.map((deck) => ({
    ...deck,
    mainDeck: [...deck.mainDeck],
    extraDeck: [...deck.extraDeck],
  })),
  characters: COMPETITION_CHARACTERS.map((character) => ({
    ...character,
    signatureCardIds: [...character.signatureCardIds],
    aiProfile: { ...character.aiProfile },
    voice: { ...character.voice },
  })),
  competitionStages: COMPETITION_STAGES.map((stage) => ({ ...stage })),
});

export const replaceGameContent = (bundle: GameContentBundle) => {
  replaceCardDb(bundle.cards);
  replaceCharacterDecks(bundle.predefinedDecks);
  replaceCompetitionCharacters(bundle.characters);
  replaceCompetitionStages(bundle.competitionStages);
};

export const buildStarterDeckSeed = (fallbackDeck: SavedDeck): SavedDeck => ({
  ...fallbackDeck,
  mainDeck: [...fallbackDeck.mainDeck],
  extraDeck: [...fallbackDeck.extraDeck],
});

export const getCurrentCharacterContent = (): CharacterContent[] =>
  COMPETITION_CHARACTERS.map((character) => ({
    ...character,
    signatureCardIds: [...character.signatureCardIds],
    aiProfile: { ...character.aiProfile },
    voice: { ...character.voice },
  }));

export const getCurrentCompetitionStages = (): CompetitionStageContent[] =>
  COMPETITION_STAGES.map((stage) => ({ ...stage }));
