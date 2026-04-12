import type { Card } from '../types';
import type { CompetitionAiProfile, CompetitionSummaryLines, EffectSupportStatus } from '../effects/types';

export interface SavedDeck {
  id: string;
  name: string;
  mainDeck: string[];
  extraDeck: string[];
  isPredefined?: boolean;
  kind?: 'starter' | 'character' | 'user';
  characterId?: string | null;
  updatedAt?: string;
}

export interface CharacterVoiceProfile {
  intro: string;
  summon: string;
  spell: string;
  trap: string;
  attack: string;
  turn: string;
  loss: string;
  forfeit: string;
}

export interface CharacterContent {
  id: string;
  name: string;
  introLine: string;
  forfeitLine: string;
  stageClearLine: string;
  defeatLine: string;
  signatureCardIds: string[];
  aiProfile: CompetitionAiProfile;
  voice: CharacterVoiceProfile;
}

export interface CompetitionStageContent {
  stageNumber: number;
  characterId: string;
  summaryOrder: number;
}

export interface CloudCardRecord extends Card {
  effectSupportStatus?: EffectSupportStatus;
  effectSupportNote?: string;
}

export interface GameContentBundle {
  cards: CloudCardRecord[];
  predefinedDecks: SavedDeck[];
  characters: CharacterContent[];
  competitionStages: CompetitionStageContent[];
}

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string;
}

export interface CompetitionProgressRecord {
  currentStageIndex: number;
  lastClearedStage: number;
  updatedAt: string;
}

export interface DuelHistoryEntry {
  id: string;
  mode: 'cpu_random' | 'cpu_custom' | 'competition';
  opponentLabel: string;
  stageIndex?: number | null;
  result: 'win' | 'loss' | 'forfeit';
  turnCount: number;
  lpRemaining: number;
  finishingCard: string | null;
  notablePlay: string;
  summary: string;
  logs: { id: string; type: string; message: string; data?: unknown }[];
  createdAt: string;
}

export interface DeckStorageState {
  decks: SavedDeck[];
  primaryDeckId: string | null;
  primaryDeckUpdatedAt: string;
}

export interface CloudProfileRow {
  id: string;
  email?: string | null;
  display_name: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CloudDeckRow {
  id: string;
  user_id: string;
  name: string;
  main_deck: string[];
  extra_deck: string[];
  is_primary: boolean;
  kind: 'starter' | 'character' | 'user';
  character_id: string | null;
  updated_at: string;
}

export interface CloudCompetitionProgressRow {
  user_id: string;
  current_stage_index: number;
  last_cleared_stage: number;
  updated_at: string;
}

export interface CloudDuelHistoryRow {
  id: string;
  user_id: string;
  mode: DuelHistoryEntry['mode'];
  opponent_label: string;
  stage_index: number | null;
  result: DuelHistoryEntry['result'];
  turn_count: number;
  lp_remaining: number;
  finishing_card: string | null;
  notable_play: string;
  summary: string;
  logs_payload: DuelHistoryEntry['logs'];
  created_at: string;
}

export interface CloudCharacterRow {
  id: string;
  name: string;
  intro_line: string;
  forfeit_line: string;
  stage_clear_line: string;
  defeat_line: string;
  signature_card_ids: string[];
  ai_profile: CompetitionAiProfile;
  voice_profile: CharacterVoiceProfile;
}

export interface CloudCompetitionStageRow {
  stage_number: number;
  character_id: string;
  summary_order: number;
}

export interface CloudPredefinedDeckRow {
  id: string;
  name: string;
  kind: 'starter' | 'character';
  main_deck: string[];
  extra_deck: string[];
  character_id: string | null;
  updated_at?: string;
}

export interface CloudCardRow {
  id: string;
  name: string;
  type: Card['type'];
  description: string;
  attribute: string | null;
  level: number | null;
  atk: number | null;
  def: number | null;
  sub_type: Card['subType'] | null;
  is_fusion: boolean | null;
  fusion_materials: string[] | null;
  effect_support_status: EffectSupportStatus | null;
  effect_support_note: string | null;
}

export interface CompetitionOpponentContent extends SavedDeck {
  stage: number;
  totalStages: number;
  voice: CharacterVoiceProfile;
  signatureCardIds: string[];
  summaryLines: CompetitionSummaryLines;
  aiProfile: CompetitionAiProfile;
}
