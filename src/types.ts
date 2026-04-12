export type CardType = 'Monster' | 'Spell' | 'Trap';

export interface Card {
  id: string;
  name: string;
  type: CardType;
  description: string;
  attribute?: string;
  level?: number;
  atk?: number;
  def?: number;
  subType?: 'Normal' | 'Equip' | 'Field' | 'Quick-Play' | 'Continuous' | 'Counter';
  isFusion?: boolean;
  fusionMaterials?: string[];
  effectSupportStatus?: 'implemented' | 'partial' | 'unsupported';
  effectSupportNote?: string;
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
