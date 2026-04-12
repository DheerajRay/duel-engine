import { GameState, GameCard, PlayerState, Phase } from '../types';
import { CARD_DB } from '../constants';
import { generateLog } from '../utils/logGenerator';
import { generateCuratedDeck } from '../utils/deckGenerator';
import { getResponseWindowOptions, resolveActivatedCardEffect, resolveTriggeredResponse } from '../effects/registry';

// Helper to create a deck
const createDeck = (): GameCard[] => {
  return generateCuratedDeck().map((id, index) => ({
    ...CARD_DB[id],
    instanceId: `${id}-${index}-${Math.random().toString(36).substr(2, 9)}`,
  })).sort(() => Math.random() - 0.5);
};

export const initialState: GameState = {
  player: {
    lp: 8000,
    deck: createDeck(),
    extraDeck: [],
    hand: [],
    graveyard: [],
    monsterZone: [null, null, null, null, null],
    spellTrapZone: [null, null, null, null, null],
  },
  opponent: {
    lp: 8000,
    deck: createDeck(),
    extraDeck: [],
    hand: [],
    graveyard: [],
    monsterZone: [null, null, null, null, null],
    spellTrapZone: [null, null, null, null, null],
  },
  turn: 'player',
  phase: 'DP',
  turnCount: 1,
  winner: null,
  normalSummonUsed: false,
  log: [generateLog('DUEL_START', { player: 'opponent' })],
};

export type Action =
  | { type: 'START_GAME', playerDeck: string[], opponentDeck: string[], playerExtraDeck?: string[], opponentExtraDeck?: string[] }
  | { type: 'DRAW_CARD', player: 'player' | 'opponent' }
  | { type: 'NEXT_PHASE' }
  | { type: 'SUMMON_MONSTER', player: 'player' | 'opponent', cardInstanceId: string, position: 'attack' | 'set-monster', tributes: number[], responseOverrides?: Record<string, boolean> }
  | { type: 'FUSION_SUMMON', player: 'player' | 'opponent', fusionMonsterId: string, materialInstanceIds: string[], spellInstanceId: string, fromZone?: number, responseOverrides?: Record<string, boolean> }
  | { type: 'CHANGE_POSITION', player: 'player' | 'opponent', zoneIndex: number, responseOverrides?: Record<string, boolean> }
  | { type: 'DECLARE_ATTACK', attackerIndex: number, targetIndex: number | null, responseOverrides?: Record<string, boolean> }
  | { type: 'ACTIVATE_SPELL', player: 'player' | 'opponent', cardInstanceId: string, fromZone?: number, discardInstanceId?: string, targetIndex?: number, targetPlayer?: 'player' | 'opponent' }
  | { type: 'ACTIVATE_TRAP', player: 'player' | 'opponent', cardInstanceId: string, fromZone: number, targetIndex?: number, targetPlayer?: 'player' | 'opponent' }
  | { type: 'SET_SPELL_TRAP', player: 'player' | 'opponent', cardInstanceId: string }
  | { type: 'AI_TURN' };

const canResolveResponse = (
  card: GameCard | null | undefined,
  responseOverrides?: Record<string, boolean>,
): boolean => {
  if (!card) return false;

  const override = responseOverrides?.[card.instanceId];
  return override !== false;
};

const restoreTemporaryControl = (state: GameState) => {
  const playerMonsterZone = [...state.player.monsterZone];
  const opponentMonsterZone = [...state.opponent.monsterZone];

  const moveBackToOwner = (
    sourceZone: (GameCard | null)[],
    targetZone: (GameCard | null)[],
    owner: 'player' | 'opponent',
  ) => {
    sourceZone.forEach((card, index) => {
      if (!card?.temporaryControl || card.originalOwner !== owner) return;

      const emptyZoneIndex = targetZone.findIndex(zoneCard => zoneCard === null);
      if (emptyZoneIndex === -1) return;

      sourceZone[index] = null;
      targetZone[emptyZoneIndex] = {
        ...card,
        temporaryControl: false,
        originalOwner: undefined,
      };
    });
  };

  moveBackToOwner(playerMonsterZone, opponentMonsterZone, 'opponent');
  moveBackToOwner(opponentMonsterZone, playerMonsterZone, 'player');

  return {
    playerMonsterZone,
    opponentMonsterZone,
  };
};

export function gameReducer(state: GameState, action: Action): GameState {
  if (state.winner && action.type !== 'START_GAME') return state;

  switch (action.type) {
    case 'START_GAME': {
      const pDeck = action.playerDeck.map((id, index) => ({
        ...CARD_DB[id],
        instanceId: `p-${id}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      })).sort(() => Math.random() - 0.5);
      
      const oDeck = action.opponentDeck.map((id, index) => ({
        ...CARD_DB[id],
        instanceId: `o-${id}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      })).sort(() => Math.random() - 0.5);

      const pExtraDeck = (action.playerExtraDeck || []).map((id, index) => ({
        ...CARD_DB[id],
        instanceId: `p-ex-${id}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      }));

      const oExtraDeck = (action.opponentExtraDeck || []).map((id, index) => ({
        ...CARD_DB[id],
        instanceId: `o-ex-${id}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      }));

      const playerHand = [];
      const opponentHand = [];
      
      for (let i = 0; i < 5; i++) {
        if (pDeck.length > 0) playerHand.push(pDeck.pop()!);
        if (oDeck.length > 0) opponentHand.push(oDeck.pop()!);
      }
      
      return { 
        ...initialState, 
        player: { ...initialState.player, deck: pDeck, extraDeck: pExtraDeck, hand: playerHand }, 
        opponent: { ...initialState.opponent, deck: oDeck, extraDeck: oExtraDeck, hand: opponentHand },
        log: [generateLog('DUEL_START', { player: 'opponent' })]
      };
    }
    case 'DRAW_CARD': {
      const pState = state[action.player];
      if (pState.deck.length === 0) {
        return { ...state, winner: action.player === 'player' ? 'opponent' : 'player', log: [...state.log, generateLog('DECK_OUT', { player: action.player })] };
      }
      const card = pState.deck[pState.deck.length - 1];
      return {
        ...state,
        [action.player]: {
          ...pState,
          deck: pState.deck.slice(0, -1),
          hand: [...pState.hand, card],
        },
        log: [...state.log, generateLog('DRAW_CARD', { player: action.player, cardName: action.player === 'player' ? card.name : undefined })],
      };
    }
    case 'NEXT_PHASE': {
      const phases: Phase[] = ['DP', 'M1', 'BP', 'M2', 'EP'];
      const currentIdx = phases.indexOf(state.phase);
      if (currentIdx === phases.length - 1) {
        const nextTurn = state.turn === 'player' ? 'opponent' : 'player';
        const { playerMonsterZone, opponentMonsterZone } = restoreTemporaryControl(state);
        const resetMonsters = (zone: (GameCard | null)[]) => zone.map(c => c ? { ...c, hasAttacked: false, justSummoned: false, changedPosition: false } : null);
        
        return {
          ...state,
          turn: nextTurn,
          phase: 'DP',
          turnCount: state.turnCount + 1,
          normalSummonUsed: false,
          player: { ...state.player, monsterZone: resetMonsters(playerMonsterZone) },
          opponent: { ...state.opponent, monsterZone: resetMonsters(opponentMonsterZone) },
          log: [...state.log, generateLog('NEXT_TURN', { nextTurn })],
        };
      } else {
        return { ...state, phase: phases[currentIdx + 1] };
      }
    }
    case 'SUMMON_MONSTER': {
      const pState = state[action.player];
      const cardIndex = pState.hand.findIndex(c => c.instanceId === action.cardInstanceId);
      if (cardIndex === -1) return state;
      const card = pState.hand[cardIndex];
      
      const emptyZoneIndex = pState.monsterZone.findIndex(z => z === null);
      if (emptyZoneIndex === -1 && action.tributes.length === 0) return state;

      const newMonsterZone = [...pState.monsterZone];
      const newGraveyard = [...pState.graveyard];
      
      action.tributes.forEach(tIndex => {
        const tCard = newMonsterZone[tIndex];
        if (tCard) newGraveyard.push(tCard);
        newMonsterZone[tIndex] = null;
      });

      const finalZoneIndex = action.tributes.length > 0 ? action.tributes[0] : emptyZoneIndex;
      
      newMonsterZone[finalZoneIndex] = { ...card, position: action.position, justSummoned: true };
      
      const newHand = [...pState.hand];
      newHand.splice(cardIndex, 1);

      let newState = {
        ...state,
        normalSummonUsed: true,
        [action.player]: {
          ...pState,
          hand: newHand,
          monsterZone: newMonsterZone,
          graveyard: newGraveyard,
        },
        log: [...state.log, generateLog(action.position === 'attack' ? 'SUMMON_MONSTER' : 'SET_MONSTER', {
          player: action.player,
          cardName: action.position === 'attack' || action.player === 'player' ? card.name : undefined,
          tributeCount: action.tributes.length,
          summonKind: 'normal',
        })],
      };

      const opponentKey = action.player === 'player' ? 'opponent' : 'player';
      const responseOptions = getResponseWindowOptions(
        newState[opponentKey],
        {
          player: newState[opponentKey],
          opponent: newState[action.player],
          normalSummonUsed: newState.normalSummonUsed,
          phase: newState.phase,
        },
        {
          type: 'monster_summoned',
          actingPlayer: action.player,
          summonedCard: card,
          zoneIndex: finalZoneIndex,
          summonKind: 'normal',
          position: action.position,
        },
      ).filter(option => canResolveResponse(option.card, action.responseOverrides));

      if (responseOptions.length > 0) {
        newState = resolveTriggeredResponse(
          newState,
          opponentKey,
          responseOptions[0].fromZone,
          {
            type: 'monster_summoned',
            actingPlayer: action.player,
            summonedCard: card,
            zoneIndex: finalZoneIndex,
            summonKind: 'normal',
            position: action.position,
          },
        );
      }

      return newState;
    }
    case 'FUSION_SUMMON': {
      const pState = state[action.player];
      
      // Find the spell card (Polymerization)
      let spellCard: GameCard | null = null;
      let newHand = [...pState.hand];
      let newSpellTrapZone = [...pState.spellTrapZone];
      let newGraveyard = [...pState.graveyard];
      
      if (action.fromZone !== undefined) {
        spellCard = newSpellTrapZone[action.fromZone];
        newSpellTrapZone[action.fromZone] = null;
      } else {
        const spellIndex = newHand.findIndex(c => c.instanceId === action.spellInstanceId);
        if (spellIndex !== -1) {
          spellCard = newHand[spellIndex];
          newHand.splice(spellIndex, 1);
        }
      }
      
      if (!spellCard) return state;
      newGraveyard.push(spellCard);

      // Find the fusion monster in the extra deck
      const fusionMonsterIndex = pState.extraDeck.findIndex(c => c.id === action.fusionMonsterId);
      if (fusionMonsterIndex === -1) return state;
      const fusionMonster = pState.extraDeck[fusionMonsterIndex];
      
      // Remove materials from hand/field
      const newMonsterZone = [...pState.monsterZone];
      
      action.materialInstanceIds.forEach(matId => {
        // Check hand
        const handIdx = newHand.findIndex(c => c.instanceId === matId);
        if (handIdx !== -1) {
          newGraveyard.push(newHand[handIdx]);
          newHand.splice(handIdx, 1);
          return;
        }
        // Check field
        const fieldIdx = newMonsterZone.findIndex(c => c?.instanceId === matId);
        if (fieldIdx !== -1) {
          newGraveyard.push(newMonsterZone[fieldIdx]!);
          newMonsterZone[fieldIdx] = null;
        }
      });

      // Summon the fusion monster
      const emptyZoneIndex = newMonsterZone.findIndex(z => z === null);
      if (emptyZoneIndex === -1) return state; // Should not happen if materials were on field, but just in case
      
      newMonsterZone[emptyZoneIndex] = { ...fusionMonster, position: 'attack', justSummoned: true };
      
      const newExtraDeck = [...pState.extraDeck];
      newExtraDeck.splice(fusionMonsterIndex, 1);

      let newState = {
        ...state,
        [action.player]: {
          ...pState,
          hand: newHand,
          monsterZone: newMonsterZone,
          spellTrapZone: newSpellTrapZone,
          graveyard: newGraveyard,
          extraDeck: newExtraDeck,
        },
        log: [
          ...state.log, 
          generateLog('ACTIVATE_SPELL', { player: action.player, cardName: spellCard.name }),
          generateLog('SUMMON_MONSTER', { player: action.player, cardName: fusionMonster.name, summonKind: 'fusion' })
        ],
      };

      const opponentKey = action.player === 'player' ? 'opponent' : 'player';
      const responseOptions = getResponseWindowOptions(
        newState[opponentKey],
        {
          player: newState[opponentKey],
          opponent: newState[action.player],
          normalSummonUsed: newState.normalSummonUsed,
          phase: newState.phase,
        },
        {
          type: 'monster_summoned',
          actingPlayer: action.player,
          summonedCard: fusionMonster,
          zoneIndex: emptyZoneIndex,
          summonKind: 'fusion',
          position: 'attack',
        },
      ).filter(option => canResolveResponse(option.card, action.responseOverrides));

      if (responseOptions.length > 0) {
        newState = resolveTriggeredResponse(
          newState,
          opponentKey,
          responseOptions[0].fromZone,
          {
            type: 'monster_summoned',
            actingPlayer: action.player,
            summonedCard: fusionMonster,
            zoneIndex: emptyZoneIndex,
            summonKind: 'fusion',
            position: 'attack',
          },
        );
      }

      return newState;
    }
    case 'CHANGE_POSITION': {
      const pState = state[action.player];
      const card = pState.monsterZone[action.zoneIndex];
      if (!card || card.justSummoned || card.changedPosition || card.hasAttacked) return state;

      const newZone = [...pState.monsterZone];
      let newPos = card.position;
      const isFlipSummon = card.position === 'set-monster';
      if (card.position === 'attack') newPos = 'defense';
      else if (card.position === 'defense' || card.position === 'set-monster') newPos = 'attack';

      newZone[action.zoneIndex] = { ...card, position: newPos, changedPosition: true };

      let newState = {
        ...state,
        [action.player]: { ...pState, monsterZone: newZone },
        log: [...state.log, generateLog('CHANGE_POSITION', { player: action.player, cardName: card.name })],
      };

      if (isFlipSummon) {
        const opponentKey = action.player === 'player' ? 'opponent' : 'player';
        const responseOptions = getResponseWindowOptions(
          newState[opponentKey],
          {
            player: newState[opponentKey],
            opponent: newState[action.player],
            normalSummonUsed: newState.normalSummonUsed,
            phase: newState.phase,
          },
          {
            type: 'monster_summoned',
            actingPlayer: action.player,
            summonedCard: card,
            zoneIndex: action.zoneIndex,
            summonKind: 'flip',
            position: newPos,
          },
        ).filter(option => canResolveResponse(option.card, action.responseOverrides));

        if (responseOptions.length > 0) {
          newState = resolveTriggeredResponse(
            newState,
            opponentKey,
            responseOptions[0].fromZone,
            {
              type: 'monster_summoned',
              actingPlayer: action.player,
              summonedCard: card,
              zoneIndex: action.zoneIndex,
              summonKind: 'flip',
              position: newPos,
            },
          );
        }
      }

      return newState;
    }
    case 'DECLARE_ATTACK': {
      if (state.phase !== 'BP') return state;
      const attacker = state[state.turn].monsterZone[action.attackerIndex];
      if (!attacker || attacker.position !== 'attack' || attacker.hasAttacked) return state;

      const opponentKey = state.turn === 'player' ? 'opponent' : 'player';
      const oppState = state[opponentKey];
      
      const newAttackerZone = [...state[state.turn].monsterZone];
      newAttackerZone[action.attackerIndex] = { ...attacker, hasAttacked: true };
      const attackState = {
        ...state,
        [state.turn]: { ...state[state.turn], monsterZone: newAttackerZone },
      };
      const declareAttackLog = {
        type: 'DECLARE_ATTACK' as const,
        data: { player: state.turn, cardName: attacker.name, targetName: action.targetIndex !== null ? oppState.monsterZone[action.targetIndex]?.name : 'directly' },
      };
      const responseOptions = getResponseWindowOptions(
        attackState[opponentKey],
        {
          player: attackState[opponentKey],
          opponent: attackState[state.turn],
          normalSummonUsed: attackState.normalSummonUsed,
          phase: attackState.phase,
        },
        {
          type: 'attack_declared',
          actingPlayer: state.turn,
          attacker,
          attackerIndex: action.attackerIndex,
          targetIndex: action.targetIndex,
        },
      ).filter(option => canResolveResponse(option.card, action.responseOverrides));

      if (responseOptions.length > 0) {
        return resolveTriggeredResponse(
          attackState,
          opponentKey,
          responseOptions[0].fromZone,
          {
            type: 'attack_declared',
            actingPlayer: state.turn,
            attacker,
            attackerIndex: action.attackerIndex,
            targetIndex: action.targetIndex,
          },
          [declareAttackLog],
        );
      }

      let newState = attackState;

      if (action.targetIndex === null) {
        const newLp = Math.max(0, oppState.lp - (attacker.atk || 0));
        newState[opponentKey] = { ...oppState, lp: newLp };
        newState.log = [...newState.log, generateLog('DIRECT_ATTACK', {
          player: state.turn,
          cardName: attacker.name,
          damage: attacker.atk || 0,
          remainingLp: newLp,
          isLethal: newLp === 0,
        })];
        if (newLp === 0) newState.winner = state.turn;
      } else {
        const target = oppState.monsterZone[action.targetIndex];
        if (!target) return state;

        newState.log = [...newState.log, generateLog('DECLARE_ATTACK', { player: state.turn, cardName: attacker.name, targetName: target.position === 'set-monster' ? 'a face-down monster' : target.name })];

        const newOppZone = [...oppState.monsterZone];
        const newOppGy = [...oppState.graveyard];
        const newTurnGy = [...newState[state.turn].graveyard];
        let newOppLp = oppState.lp;
        let newTurnLp = newState[state.turn].lp;

        if (target.position === 'attack') {
          if (attacker.atk! > target.atk!) {
            newOppGy.push(target);
            newOppZone[action.targetIndex] = null;
            newOppLp = Math.max(0, newOppLp - (attacker.atk! - target.atk!));
            newState.log = [...newState.log, generateLog('MONSTER_DESTROYED', { player: opponentKey, cardName: target.name }), generateLog('BATTLE_DAMAGE', { player: opponentKey, damage: attacker.atk! - target.atk!, cardName: attacker.name, remainingLp: newOppLp, isLethal: newOppLp === 0 })];
          } else if (attacker.atk! < target.atk!) {
            newTurnGy.push(attacker);
            newAttackerZone[action.attackerIndex] = null;
            newTurnLp = Math.max(0, newTurnLp - (target.atk! - attacker.atk!));
            newState.log = [...newState.log, generateLog('MONSTER_DESTROYED', { player: state.turn, cardName: attacker.name }), generateLog('BATTLE_DAMAGE', { player: state.turn, damage: target.atk! - attacker.atk!, cardName: target.name, remainingLp: newTurnLp, isLethal: newTurnLp === 0 })];
          } else {
            newOppGy.push(target);
            newOppZone[action.targetIndex] = null;
            newTurnGy.push(attacker);
            newAttackerZone[action.attackerIndex] = null;
            newState.log = [...newState.log, generateLog('MONSTER_DESTROYED', { player: 'both', cardName: 'Both monsters' })];
          }
        } else {
          if (target.position === 'set-monster') {
            newState.log = [...newState.log, generateLog('FACE_DOWN_REVEALED', { cardName: target.name })];
          }
          if (attacker.atk! > target.def!) {
            newOppGy.push(target);
            newOppZone[action.targetIndex] = null;
            newState.log = [...newState.log, generateLog('MONSTER_DESTROYED', { player: opponentKey, cardName: target.name })];
          } else if (attacker.atk! < target.def!) {
            newTurnLp = Math.max(0, newTurnLp - (target.def! - attacker.atk!));
            newState.log = [...newState.log, generateLog('BATTLE_DAMAGE', { player: state.turn, damage: target.def! - attacker.atk!, cardName: target.name, remainingLp: newTurnLp, isLethal: newTurnLp === 0 })];
            if (target.position === 'set-monster') {
               newOppZone[action.targetIndex] = { ...target, position: 'defense' };
            }
          } else {
            newState.log = [...newState.log, generateLog('NO_MONSTERS_DESTROYED', {})];
             if (target.position === 'set-monster') {
               newOppZone[action.targetIndex] = { ...target, position: 'defense' };
            }
          }
        }

        newState[opponentKey] = { ...oppState, lp: newOppLp, monsterZone: newOppZone, graveyard: newOppGy };
        newState[state.turn] = { ...newState[state.turn], lp: newTurnLp, monsterZone: newAttackerZone, graveyard: newTurnGy };
        
        if (newOppLp === 0) newState.winner = state.turn;
        if (newTurnLp === 0) newState.winner = opponentKey;
      }

      return newState;
    }
    case 'SET_SPELL_TRAP': {
      const pState = state[action.player];
      const cardIndex = pState.hand.findIndex(c => c.instanceId === action.cardInstanceId);
      if (cardIndex === -1) return state;

      const emptyZoneIndex = pState.spellTrapZone.findIndex(z => z === null);
      if (emptyZoneIndex === -1) return state;

      const card = pState.hand[cardIndex];
      const newHand = [...pState.hand];
      newHand.splice(cardIndex, 1);

      const newZone = [...pState.spellTrapZone];
      newZone[emptyZoneIndex] = { ...card, position: 'set-spell' };

      return {
        ...state,
        [action.player]: {
          ...pState,
          hand: newHand,
          spellTrapZone: newZone,
        },
        log: [...state.log, generateLog('SET_SPELL_TRAP', { player: action.player, cardName: action.player === 'player' ? card.name : undefined })],
      };
    }
    case 'ACTIVATE_SPELL': {
      return resolveActivatedCardEffect(state, action);
    }
    case 'ACTIVATE_TRAP': {
      return resolveActivatedCardEffect(state, action);
    }
    default:
      return state;
  }
}
