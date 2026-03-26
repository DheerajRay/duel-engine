import { CARD_DB } from '../constants';
import { GameCard, GameState, PlayerState } from '../types';

let instanceCounter = 0;

export const makeCard = (id: string, overrides: Partial<GameCard> = {}): GameCard => {
  const base = CARD_DB[id];

  if (!base) {
    throw new Error(`Unknown card id for test: ${id}`);
  }

  instanceCounter += 1;

  return {
    ...base,
    instanceId: `${id}-test-${instanceCounter}`,
    ...overrides,
  };
};

export const makePlayerState = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  lp: 8000,
  deck: [],
  extraDeck: [],
  hand: [],
  graveyard: [],
  monsterZone: [null, null, null, null, null],
  spellTrapZone: [null, null, null, null, null],
  ...overrides,
});

export const makeGameState = (overrides: Partial<GameState> = {}): GameState => ({
  player: makePlayerState(),
  opponent: makePlayerState(),
  turn: 'player',
  phase: 'M1',
  turnCount: 1,
  winner: null,
  normalSummonUsed: false,
  log: [],
  ...overrides,
});
