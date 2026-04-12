export type CardType = 'Monster' | 'Spell' | 'Trap';
export type CardSourceType = 'official' | 'anime' | 'custom' | 'unknown';
export type CardTextSource = 'csv' | 'manual' | 'external_api' | 'mixed';
export type CardVerificationStatus = 'verified' | 'needs_review' | 'unverified';

export interface Card {
  id: string;
  name: string;
  type: CardType;
  description: string;
  sourceType?: CardSourceType;
  textSource?: CardTextSource;
  verificationStatus?: CardVerificationStatus;
  lastVerifiedAt?: string;
  notes?: string;
  originalPage?: number;
  matchedSnapshot?: boolean;
  passcode?: string;
  cardStatus?: string;
  attribute?: string;
  level?: number;
  rank?: number;
  linkRating?: number;
  linkArrows?: string[];
  pendulumScale?: number;
  atk?: number;
  def?: number;
  subType?: 'Normal' | 'Equip' | 'Field' | 'Quick-Play' | 'Continuous' | 'Counter';
  monsterTypeLine?: string;
  monsterRace?: string;
  monsterAbilities?: string[];
  spellTrapProperty?: string;
  isFusion?: boolean;
  fusionMaterials?: string[];
  summoningCondition?: string;
  pendulumEffect?: string;
  supports?: string[];
  antiSupports?: string[];
  cardActions?: string[];
  effectTypes?: string[];
  effectSupportStatus?: 'implemented' | 'partial' | 'unsupported';
  effectSupportNote?: string;
  engineBehaviorKey?: string;
  isPlayableInEngine?: boolean;
  requiresManualTargeting?: boolean;
  hasHiddenInformationImpact?: boolean;
  aiPriorityWeight?: number;
}

export interface GameCard extends Card {
  instanceId: string;
  position?: 'attack' | 'defense' | 'set-monster' | 'set-spell' | 'face-up-spell';
  hasAttacked?: boolean;
  justSummoned?: boolean;
  changedPosition?: boolean;
  originalOwner?: 'player' | 'opponent';
  temporaryControl?: boolean;
}

export interface PlayerState {
  lp: number;
  deck: GameCard[];
  extraDeck: GameCard[];
  hand: GameCard[];
  graveyard: GameCard[];
  monsterZone: (GameCard | null)[];
  spellTrapZone: (GameCard | null)[];
}

export type Phase = 'DP' | 'M1' | 'BP' | 'M2' | 'EP';

export interface LogEntry {
  id: string;
  type: string;
  message: string;
  data?: any;
}

export interface GameState {
  player: PlayerState;
  opponent: PlayerState;
  turn: 'player' | 'opponent';
  phase: Phase;
  turnCount: number;
  winner: 'player' | 'opponent' | null;
  normalSummonUsed: boolean;
  log: LogEntry[];
}
