import { getSupabaseClient } from '../lib/supabase';
import { rebuildEffectRegistry } from '../effects/registry';
import {
  getLocalGameContentBundle,
  replaceGameContent,
} from './gameContentStore';
import type {
  CloudCardRow,
  CloudCharacterRow,
  CloudCompetitionStageRow,
  CloudPredefinedDeckRow,
  GameContentBundle,
} from '../types/cloud';

const GAME_CONTENT_CACHE_KEY = 'ygo_game_content_cache_v1';

const serializeBundle = (bundle: GameContentBundle) => JSON.stringify(bundle);

const readCachedBundle = (): GameContentBundle | null => {
  const raw = localStorage.getItem(GAME_CONTENT_CACHE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as GameContentBundle;
  } catch {
    return null;
  }
};

const cacheBundle = (bundle: GameContentBundle) => {
  localStorage.setItem(GAME_CONTENT_CACHE_KEY, serializeBundle(bundle));
};

const mapCloudCards = (rows: CloudCardRow[]) => rows.map((row) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  description: row.description,
  attribute: row.attribute ?? undefined,
  level: row.level ?? undefined,
  atk: row.atk ?? undefined,
  def: row.def ?? undefined,
  subType: row.sub_type ?? undefined,
  isFusion: row.is_fusion ?? undefined,
  fusionMaterials: row.fusion_materials ?? undefined,
  effectSupportStatus: row.effect_support_status ?? undefined,
  effectSupportNote: row.effect_support_note ?? undefined,
}));

const mapCloudDecks = (rows: CloudPredefinedDeckRow[]) => rows.map((row) => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  mainDeck: row.main_deck,
  extraDeck: row.extra_deck,
  characterId: row.character_id,
  isPredefined: true,
  updatedAt: row.updated_at,
}));

const mapCloudCharacters = (rows: CloudCharacterRow[]) => rows.map((row) => ({
  id: row.id,
  name: row.name,
  introLine: row.intro_line,
  forfeitLine: row.forfeit_line,
  stageClearLine: row.stage_clear_line,
  defeatLine: row.defeat_line,
  signatureCardIds: row.signature_card_ids ?? [],
  aiProfile: row.ai_profile,
  voice: row.voice_profile,
}));

const mapCloudStages = (rows: CloudCompetitionStageRow[]) => rows.map((row) => ({
  stageNumber: row.stage_number,
  characterId: row.character_id,
  summaryOrder: row.summary_order,
}));

export const initializeGameContent = async (): Promise<{ source: 'supabase' | 'cache' | 'local'; bundle: GameContentBundle }> => {
  const localBundle = getLocalGameContentBundle();
  const client = getSupabaseClient();

  if (!client) {
    replaceGameContent(localBundle);
    rebuildEffectRegistry();
    return { source: 'local', bundle: localBundle };
  }

  try {
    const [cardsResult, decksResult, charactersResult, stagesResult] = await Promise.all([
      client.from('cards').select('*').order('name'),
      client.from('predefined_decks').select('*').order('name'),
      client.from('characters').select('*').order('name'),
      client.from('competition_stages').select('*').order('stage_number'),
    ]);

    if (cardsResult.error || decksResult.error || charactersResult.error || stagesResult.error) {
      throw cardsResult.error || decksResult.error || charactersResult.error || stagesResult.error;
    }

    const bundle: GameContentBundle = {
      cards: mapCloudCards((cardsResult.data as CloudCardRow[]) ?? []),
      predefinedDecks: mapCloudDecks((decksResult.data as CloudPredefinedDeckRow[]) ?? []),
      characters: mapCloudCharacters((charactersResult.data as CloudCharacterRow[]) ?? []),
      competitionStages: mapCloudStages((stagesResult.data as CloudCompetitionStageRow[]) ?? []),
    };

    if (
      bundle.cards.length > 0 &&
      bundle.predefinedDecks.length > 0 &&
      bundle.characters.length > 0 &&
      bundle.competitionStages.length > 0
    ) {
      replaceGameContent(bundle);
      cacheBundle(bundle);
      rebuildEffectRegistry();
      return { source: 'supabase', bundle };
    }

    throw new Error('Supabase game content is incomplete.');
  } catch {
    const cachedBundle = readCachedBundle();
    const bundle = cachedBundle ?? localBundle;
    replaceGameContent(bundle);
    rebuildEffectRegistry();
    return { source: cachedBundle ? 'cache' : 'local', bundle };
  }
};
