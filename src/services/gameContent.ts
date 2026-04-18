import { getSupabaseClient } from '../lib/supabase';
import { rebuildEffectRegistry } from '../effects/registry';
import {
  getLocalGameContentBundle,
  replaceGameContent,
} from './gameContentStore';
import type {
  CloudCardRow,
  CloudCardEngineMetadataRow,
  CloudCharacterRow,
  CloudCompetitionStageRow,
  CloudPredefinedDeckRow,
  GameContentBundle,
} from '../types/cloud';

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }) as Promise<T>;
};

const mapCloudCards = (
  rows: CloudCardRow[],
  engineRows: CloudCardEngineMetadataRow[],
) => {
  const engineMap = new Map(engineRows.map((row) => [row.card_id, row]));

  return rows.map((row) => {
    const engineRow = engineMap.get(row.id);
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      sourceType: row.source_type ?? undefined,
      textSource: row.text_source ?? undefined,
      verificationStatus: row.verification_status ?? undefined,
      lastVerifiedAt: row.last_verified_at ?? undefined,
      notes: row.notes ?? undefined,
      originalPage: row.original_page ?? undefined,
      matchedSnapshot: row.matched_snapshot ?? undefined,
      passcode: row.passcode ?? undefined,
      cardStatus: row.card_status ?? undefined,
      attribute: row.attribute ?? undefined,
      level: row.level ?? undefined,
      rank: row.rank ?? undefined,
      linkRating: row.link_rating ?? undefined,
      linkArrows: row.link_arrows ?? undefined,
      pendulumScale: row.pendulum_scale ?? undefined,
      atk: row.atk ?? undefined,
      def: row.def ?? undefined,
      subType: row.sub_type ?? undefined,
      monsterTypeLine: row.monster_type_line ?? undefined,
      monsterRace: row.monster_race ?? undefined,
      monsterAbilities: row.monster_abilities ?? undefined,
      spellTrapProperty: row.spell_trap_property ?? undefined,
      isFusion: row.is_fusion ?? undefined,
      fusionMaterials: row.fusion_materials ?? undefined,
      summoningCondition: row.summoning_condition ?? undefined,
      pendulumEffect: row.pendulum_effect ?? undefined,
      supports: row.support_tags ?? undefined,
      antiSupports: row.anti_support_tags ?? undefined,
      cardActions: row.card_actions ?? undefined,
      effectTypes: row.effect_types ?? undefined,
      effectSupportStatus: engineRow?.effect_support_status ?? row.effect_support_status ?? undefined,
      effectSupportNote: engineRow?.effect_support_note ?? row.effect_support_note ?? undefined,
      engineBehaviorKey: engineRow?.engine_behavior_key ?? undefined,
      isPlayableInEngine: engineRow?.is_playable_in_engine ?? undefined,
      requiresManualTargeting: engineRow?.requires_manual_targeting ?? undefined,
      hasHiddenInformationImpact: engineRow?.has_hidden_information_impact ?? undefined,
      aiPriorityWeight: engineRow?.ai_priority_weight ?? undefined,
    };
  });
};

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

export const initializeGameContent = async (): Promise<{ source: 'supabase' | 'local'; bundle: GameContentBundle }> => {
  const localBundle = getLocalGameContentBundle();
  const client = getSupabaseClient();

  if (!client) {
    replaceGameContent(localBundle);
    rebuildEffectRegistry();
    return { source: 'local', bundle: localBundle };
  }

  try {
    const [cardsResult, engineResult, decksResult, charactersResult, stagesResult] = await withTimeout(
      Promise.all([
        client.from('cards').select('*').order('name'),
        client.from('card_engine_metadata').select('*').order('card_id'),
        client.from('predefined_decks').select('*').order('name'),
        client.from('characters').select('*').order('name'),
        client.from('competition_stages').select('*').order('stage_number'),
      ]),
      5000,
    );

    if (cardsResult.error || engineResult.error || decksResult.error || charactersResult.error || stagesResult.error) {
      throw cardsResult.error || engineResult.error || decksResult.error || charactersResult.error || stagesResult.error;
    }

    const bundle: GameContentBundle = {
      cards: mapCloudCards(
        (cardsResult.data as CloudCardRow[]) ?? [],
        (engineResult.data as CloudCardEngineMetadataRow[]) ?? [],
      ),
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
      rebuildEffectRegistry();
      return { source: 'supabase', bundle };
    }

    throw new Error('Supabase game content is incomplete.');
  } catch {
    replaceGameContent(localBundle);
    rebuildEffectRegistry();
    return { source: 'local', bundle: localBundle };
  }
};
