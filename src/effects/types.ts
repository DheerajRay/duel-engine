import type { Card, CardType, GameCard, GameState, Phase, PlayerState } from '../types';
import type { LogActionType } from '../utils/logGenerator';

export type EffectSupportStatus = 'implemented' | 'partial' | 'unsupported';

export interface CardPlayRules {
  canNormalSummon: boolean;
  canSetMonster: boolean;
  tributeRequirement?: number;
  summonRestrictionText?: string;
}

export interface CardActivationRules {
  canActivateFromHand: boolean;
  canActivateWhenSet: boolean;
  legalPhases: Phase[];
  targetLabel?: string;
}

export type CardTargetZone = 'monster-zone' | 'spell-trap-zone' | 'graveyard' | 'extra-deck';
export type CardTargetOwner = 'player' | 'opponent' | 'either';
export type CardTargetKind = 'monster' | 'spell' | 'spell-trap' | 'fusion-monster' | 'card';

export interface CardTargetRules {
  zones: CardTargetZone[];
  owner: CardTargetOwner;
  kind: CardTargetKind;
  minTargets: number;
  maxTargets: number;
  description: string;
}

export interface CardAiHints {
  basePriority: number;
  signatureWeight: number;
  tags: string[];
}

export interface ActivationContext {
  player: PlayerState;
  opponent: PlayerState;
  normalSummonUsed: boolean;
  phase?: Phase;
}

export interface CardActionAvailability {
  summon: boolean;
  setMonster: boolean;
  activate: boolean;
  setSpellTrap: boolean;
}

export type ResponseTriggerContext =
  | {
      type: 'attack_declared';
      actingPlayer: 'player' | 'opponent';
      attacker: GameCard;
      attackerIndex: number;
      targetIndex: number | null;
    }
  | {
      type: 'monster_summoned';
      actingPlayer: 'player' | 'opponent';
      summonedCard: GameCard;
      zoneIndex: number;
      summonKind: 'normal' | 'fusion' | 'flip';
      position: GameCard['position'];
    };

export interface ResponseWindowOption {
  card: GameCard;
  fromZone: number;
  title: string;
  description: string;
}

export interface TriggeredEffectResolutionContext {
  state: GameState;
  responder: 'player' | 'opponent';
  fromZone: number;
  trigger: ResponseTriggerContext;
  preEffectLogs?: { type: LogActionType; data?: any }[];
}

export interface CardResolverContext {
  state: GameState;
  playerKey: 'player' | 'opponent';
  opponentKey: 'player' | 'opponent';
  card: GameCard;
  fromZone?: number;
  targetIndex?: number;
  targetPlayer?: 'player' | 'opponent';
  discardInstanceId?: string;
  playerState: PlayerState;
  opponentState: PlayerState;
  hand: GameCard[];
  playerMonsterZone: (GameCard | null)[];
  playerSpellTrapZone: (GameCard | null)[];
  playerGraveyard: GameCard[];
  playerDeck: GameCard[];
  opponentMonsterZone: (GameCard | null)[];
  opponentSpellTrapZone: (GameCard | null)[];
  opponentGraveyard: GameCard[];
  playerLp: number;
  opponentLp: number;
  winner: GameState['winner'];
  log: { type: LogActionType; data?: any }[];
}

export interface CardEffectRegistryEntry {
  id: string;
  supportStatus: EffectSupportStatus;
  supportNote?: string;
  playRules: CardPlayRules;
  activationRules?: CardActivationRules;
  targetRules?: CardTargetRules[];
  aiHints: CardAiHints;
  canActivate?: (card: Pick<GameCard, 'id' | 'instanceId'>, context: ActivationContext, fromZone?: number) => boolean;
  getResponseWindow?: (
    card: GameCard,
    fromZone: number,
    trigger: ResponseTriggerContext,
    context: ActivationContext,
  ) => ResponseWindowOption | null;
  resolveActivated?: (context: CardResolverContext) => void;
  resolveTriggered?: (context: TriggeredEffectResolutionContext) => GameState;
}

export interface CardSupportMeta {
  status: EffectSupportStatus;
  label: string;
  note?: string;
}

export interface CompetitionAiProfile {
  aggression: number;
  signatureWeight: number;
  removalBias: number;
  backrowBias: number;
  comebackBias: number;
}

export interface CompetitionSummaryLines {
  stageClear: string;
  defeat: string;
}

export interface CardPreview extends Card {
  instanceId: string;
}
