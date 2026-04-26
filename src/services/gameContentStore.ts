import type { Card } from '../types';
import { APP_LANGUAGES, type AppLanguage } from '../types/preferences';
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

type CardLocalizationRecord = {
  name: string;
  description: string;
};

export const CARD_LOCALIZATIONS: Record<AppLanguage, Record<string, CardLocalizationRecord>> = {
  en: {},
  es: {},
  hi: {},
  ja: {},
};

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

export const replaceCardLocalizations = (
  rows: { card_id: string; language: AppLanguage; name: string; description: string }[],
) => {
  APP_LANGUAGES.forEach((language) => {
    Object.keys(CARD_LOCALIZATIONS[language]).forEach((key) => {
      delete CARD_LOCALIZATIONS[language][key];
    });
  });

  rows.forEach((row) => {
    CARD_LOCALIZATIONS[row.language][row.card_id] = {
      name: row.name,
      description: row.description,
    };
  });
};

export const getLocalGameContentBundle = (): GameContentBundle => ({
  cards: Object.values(LOCAL_CARD_DB).map((card) => ({
    ...card,
    fusionMaterials: card.fusionMaterials ? [...card.fusionMaterials] : undefined,
  })),
  cardLocalizations: Object.values(LOCAL_CARD_DB).map((card) => ({
    card_id: card.id,
    language: 'en' as const,
    name: card.name,
    description: card.description,
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
  replaceCardLocalizations(bundle.cardLocalizations);
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
