import { GameState, GameCard, PlayerState, Phase } from '../types';
import { CARD_DB } from '../constants';
import { generateLog } from '../utils/logGenerator';
import { generateCuratedDeck } from '../utils/deckGenerator';

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
        log: [...state.log, generateLog(action.position === 'attack' ? 'SUMMON_MONSTER' : 'SET_MONSTER', { player: action.player, cardName: action.position === 'attack' || action.player === 'player' ? card.name : undefined })],
      };

      // Check for Trap Hole
      if (action.position === 'attack' && (card.atk || 0) >= 1000) {
        const opponentKey = action.player === 'player' ? 'opponent' : 'player';
        const oppState = newState[opponentKey];
        const trapIndex = oppState.spellTrapZone.findIndex(c => c?.id === 'trap-hole' && c.position === 'set-spell' && canResolveResponse(c, action.responseOverrides));
        
        if (trapIndex !== -1) {
          const trapCard = oppState.spellTrapZone[trapIndex]!;
          const newOppSTZone = [...oppState.spellTrapZone];
          newOppSTZone[trapIndex] = null;
          const newOppGy = [...oppState.graveyard, trapCard];
          
          const newPlayerZone = [...newState[action.player].monsterZone];
          newPlayerZone[finalZoneIndex] = null;
          const newPlayerGy = [...newState[action.player].graveyard, card];
          
          newState = {
            ...newState,
            [opponentKey]: { ...oppState, spellTrapZone: newOppSTZone, graveyard: newOppGy },
            [action.player]: { ...newState[action.player], monsterZone: newPlayerZone, graveyard: newPlayerGy },
            log: [
              ...newState.log,
              generateLog('ACTIVATE_TRAP', { player: opponentKey, cardName: trapCard.name }),
              generateLog('MONSTER_DESTROYED', { player: action.player, cardName: card.name })
            ]
          };
        }
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
          generateLog('SUMMON_MONSTER', { player: action.player, cardName: fusionMonster.name })
        ],
      };

      // Check for Trap Hole
      if ((fusionMonster.atk || 0) >= 1000) {
        const opponentKey = action.player === 'player' ? 'opponent' : 'player';
        const oppState = newState[opponentKey];
        const trapIndex = oppState.spellTrapZone.findIndex(c => c?.id === 'trap-hole' && c.position === 'set-spell' && canResolveResponse(c, action.responseOverrides));
        
        if (trapIndex !== -1) {
          const trapCard = oppState.spellTrapZone[trapIndex]!;
          const newOppSTZone = [...oppState.spellTrapZone];
          newOppSTZone[trapIndex] = null;
          const newOppGy = [...oppState.graveyard, trapCard];
          
          const newPlayerZone = [...newState[action.player].monsterZone];
          newPlayerZone[emptyZoneIndex] = null;
          const newPlayerGy = [...newState[action.player].graveyard, fusionMonster];
          
          newState = {
            ...newState,
            [opponentKey]: { ...oppState, spellTrapZone: newOppSTZone, graveyard: newOppGy },
            [action.player]: { ...newState[action.player], monsterZone: newPlayerZone, graveyard: newPlayerGy },
            log: [
              ...newState.log,
              generateLog('ACTIVATE_TRAP', { player: opponentKey, cardName: trapCard.name }),
              generateLog('MONSTER_DESTROYED', { player: action.player, cardName: fusionMonster.name })
            ]
          };
        }
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

      // Check for Trap Hole on Flip Summon
      if (isFlipSummon && newPos === 'attack' && (card.atk || 0) >= 1000) {
        const opponentKey = action.player === 'player' ? 'opponent' : 'player';
        const oppState = newState[opponentKey];
        const trapIndex = oppState.spellTrapZone.findIndex(c => c?.id === 'trap-hole' && c.position === 'set-spell' && canResolveResponse(c, action.responseOverrides));
        
        if (trapIndex !== -1) {
          const trapCard = oppState.spellTrapZone[trapIndex]!;
          const newOppSTZone = [...oppState.spellTrapZone];
          newOppSTZone[trapIndex] = null;
          const newOppGy = [...oppState.graveyard, trapCard];
          
          const newPlayerZone = [...newState[action.player].monsterZone];
          newPlayerZone[action.zoneIndex] = null;
          const newPlayerGy = [...newState[action.player].graveyard, card];
          
          newState = {
            ...newState,
            [opponentKey]: { ...oppState, spellTrapZone: newOppSTZone, graveyard: newOppGy },
            [action.player]: { ...newState[action.player], monsterZone: newPlayerZone, graveyard: newPlayerGy },
            log: [
              ...newState.log,
              generateLog('ACTIVATE_TRAP', { player: opponentKey, cardName: trapCard.name }),
              generateLog('MONSTER_DESTROYED', { player: action.player, cardName: card.name })
            ]
          };
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
      
      let newState = {
        ...state,
        [state.turn]: { ...state[state.turn], monsterZone: newAttackerZone },
      };

      // Check for traps
      const mirrorForceIndex = oppState.spellTrapZone.findIndex(c => c?.id === 'mirror-force' && c.position === 'set-spell' && canResolveResponse(c, action.responseOverrides));
      if (mirrorForceIndex !== -1) {
        const trapCard = oppState.spellTrapZone[mirrorForceIndex]!;
        const newOppSTZone = [...oppState.spellTrapZone];
        newOppSTZone[mirrorForceIndex] = null;
        const newOppGy = [...oppState.graveyard, trapCard];
        
        const newTurnZone = [...newState[state.turn].monsterZone];
        const newTurnGy = [...newState[state.turn].graveyard];
        
        newTurnZone.forEach((m, i) => {
          if (m && m.position === 'attack') {
            newTurnGy.push(m);
            newTurnZone[i] = null;
          }
        });
        
        return {
          ...newState,
          [opponentKey]: { ...oppState, spellTrapZone: newOppSTZone, graveyard: newOppGy },
          [state.turn]: { ...newState[state.turn], monsterZone: newTurnZone, graveyard: newTurnGy },
          log: [
            ...newState.log, 
            generateLog('DECLARE_ATTACK', { player: state.turn, cardName: attacker.name, targetName: action.targetIndex !== null ? oppState.monsterZone[action.targetIndex]?.name : 'directly' }),
            generateLog('ACTIVATE_TRAP', { player: opponentKey, cardName: trapCard.name }),
            generateLog('MONSTER_DESTROYED', { player: state.turn, cardName: 'All Attack Position monsters' })
          ]
        };
      }

      const magicCylinderIndex = oppState.spellTrapZone.findIndex(c => c?.id === 'magic-cylinder' && c.position === 'set-spell' && canResolveResponse(c, action.responseOverrides));
      if (magicCylinderIndex !== -1) {
        const trapCard = oppState.spellTrapZone[magicCylinderIndex]!;
        const newOppSTZone = [...oppState.spellTrapZone];
        newOppSTZone[magicCylinderIndex] = null;
        const newOppGy = [...oppState.graveyard, trapCard];
        
        const newTurnLp = Math.max(0, newState[state.turn].lp - (attacker.atk || 0));
        
        return {
          ...newState,
          [opponentKey]: { ...oppState, spellTrapZone: newOppSTZone, graveyard: newOppGy },
          [state.turn]: { ...newState[state.turn], lp: newTurnLp },
          winner: newTurnLp === 0 ? opponentKey : newState.winner,
          log: [
            ...newState.log, 
            generateLog('DECLARE_ATTACK', { player: state.turn, cardName: attacker.name, targetName: action.targetIndex !== null ? oppState.monsterZone[action.targetIndex]?.name : 'directly' }),
            generateLog('ACTIVATE_TRAP', { player: opponentKey, cardName: trapCard.name }),
            generateLog('BATTLE_DAMAGE', { player: state.turn, damage: attacker.atk || 0, cardName: trapCard.name })
          ]
        };
      }

      const negateAttackIndex = oppState.spellTrapZone.findIndex(c => c?.id === 'negate-attack' && c.position === 'set-spell' && canResolveResponse(c, action.responseOverrides));
      if (negateAttackIndex !== -1) {
        const trapCard = oppState.spellTrapZone[negateAttackIndex]!;
        const newOppSTZone = [...oppState.spellTrapZone];
        newOppSTZone[negateAttackIndex] = null;
        const newOppGy = [...oppState.graveyard, trapCard];

        return {
          ...newState,
          phase: 'M2',
          [opponentKey]: { ...oppState, spellTrapZone: newOppSTZone, graveyard: newOppGy },
          log: [
            ...newState.log,
            generateLog('DECLARE_ATTACK', { player: state.turn, cardName: attacker.name, targetName: action.targetIndex !== null ? oppState.monsterZone[action.targetIndex]?.name : 'directly' }),
            generateLog('ACTIVATE_TRAP', { player: opponentKey, cardName: trapCard.name }),
            generateLog('SYSTEM_MESSAGE', { message: 'The attack was negated and the Battle Phase ended.' }),
          ],
        };
      }

      if (action.targetIndex === null) {
        const newLp = Math.max(0, oppState.lp - (attacker.atk || 0));
        newState[opponentKey] = { ...oppState, lp: newLp };
        newState.log = [...newState.log, generateLog('DIRECT_ATTACK', { player: state.turn, cardName: attacker.name, damage: attacker.atk || 0 })];
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
            newState.log = [...newState.log, generateLog('MONSTER_DESTROYED', { player: opponentKey, cardName: target.name }), generateLog('BATTLE_DAMAGE', { player: opponentKey, damage: attacker.atk! - target.atk!, cardName: attacker.name })];
          } else if (attacker.atk! < target.atk!) {
            newTurnGy.push(attacker);
            newAttackerZone[action.attackerIndex] = null;
            newTurnLp = Math.max(0, newTurnLp - (target.atk! - attacker.atk!));
            newState.log = [...newState.log, generateLog('MONSTER_DESTROYED', { player: state.turn, cardName: attacker.name }), generateLog('BATTLE_DAMAGE', { player: state.turn, damage: target.atk! - attacker.atk!, cardName: target.name })];
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
            newState.log = [...newState.log, generateLog('BATTLE_DAMAGE', { player: state.turn, damage: target.def! - attacker.atk!, cardName: target.name })];
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
      const pState = state[action.player];
      const oppKey = action.player === 'player' ? 'opponent' : 'player';
      const oppState = state[oppKey];
      
      let card: GameCard;
      let newHand = [...pState.hand];
      let newSpellZone = [...pState.spellTrapZone];
      
      if (action.fromZone !== undefined) {
        card = newSpellZone[action.fromZone]!;
        newSpellZone[action.fromZone] = null;
      } else {
        const cardIndex = newHand.findIndex(c => c.instanceId === action.cardInstanceId);
        if (cardIndex === -1) return state;
        card = newHand[cardIndex];
        newHand.splice(cardIndex, 1);
      }

      let newState = { ...state };
      let newOppZone = [...oppState.monsterZone];
      let newOppGy = [...oppState.graveyard];
      let newTurnGy = [...pState.graveyard];
      let newTurnZone = [...pState.monsterZone];
      let newOppSTZone = [...oppState.spellTrapZone];
      let newOppLp = oppState.lp;
      let newTurnLp = pState.lp;

      newState.log = [...newState.log, generateLog('ACTIVATE_SPELL', { player: action.player, cardName: card.name })];

      if (card.id === 'dark-hole') {
        newOppZone.forEach(m => m && newOppGy.push(m));
        newOppZone = [null, null, null, null, null];
        newTurnZone.forEach(m => m && newTurnGy.push(m));
        newTurnZone = [null, null, null, null, null];
        newState.log = [...newState.log, generateLog('SPELL_EFFECT', { player: action.player, effectType: 'dark-hole' })];
      } else if (card.id === 'raigeki') {
        newOppZone.forEach(m => m && newOppGy.push(m));
        newOppZone = [null, null, null, null, null];
        newState.log = [...newState.log, generateLog('SPELL_EFFECT', { player: action.player, effectType: 'raigeki' })];
      } else if (card.id === 'fissure') {
        let lowestAtk = Infinity;
        let targetIdx = -1;
        newOppZone.forEach((m, idx) => {
          if (m && m.position !== 'set-monster' && m.atk! < lowestAtk) {
            lowestAtk = m.atk!;
            targetIdx = idx;
          }
        });
        if (targetIdx !== -1) {
          newOppGy.push(newOppZone[targetIdx]!);
          newState.log = [...newState.log, generateLog('MONSTER_DESTROYED', { player: oppKey, cardName: newOppZone[targetIdx]!.name })];
          newOppZone[targetIdx] = null;
        } else {
           newState.log = [...newState.log, generateLog('SPELL_EFFECT', { player: action.player, effectType: 'fissure-fail' })];
        }
      } else if (card.id === 'hinotama') {
        newOppLp = Math.max(0, newOppLp - 500);
        newState.log = [...newState.log, generateLog('BATTLE_DAMAGE', { player: oppKey, damage: 500, cardName: card.name })];
        if (newOppLp === 0) newState.winner = action.player;
      } else if (card.id === 'pot-of-greed') {
        let pDeck = [...pState.deck];
        for (let i = 0; i < 2; i++) {
          if (pDeck.length > 0) {
             newHand.push(pDeck.pop()!);
          }
        }
        newState[action.player] = { ...newState[action.player], deck: pDeck };
        newState.log = [...newState.log, generateLog('SPELL_EFFECT', { player: action.player, effectType: 'pot-of-greed' })];
      } else if (card.id === 'harpie-s-feather-duster') {
        newOppSTZone.forEach(c => c && newOppGy.push(c));
        newOppSTZone = [null, null, null, null, null];
        newState.log = [...newState.log, generateLog('SPELL_EFFECT', { player: action.player, effectType: 'harpies-feather-duster' })];
      } else if (card.id === 'tribute-to-the-doomed') {
        if (action.discardInstanceId && action.targetIndex !== undefined && action.targetPlayer) {
          const discardIdx = newHand.findIndex(c => c.instanceId === action.discardInstanceId);
          if (discardIdx !== -1) {
            const discardedCard = newHand[discardIdx];
            newHand.splice(discardIdx, 1);
            newTurnGy.push(discardedCard);
            
            const targetZone = action.targetPlayer === action.player ? newTurnZone : newOppZone;
            const targetGy = action.targetPlayer === action.player ? newTurnGy : newOppGy;
            
            if (targetZone[action.targetIndex]) {
               targetGy.push(targetZone[action.targetIndex]!);
               newState.log = [...newState.log, generateLog('MONSTER_DESTROYED', { player: action.targetPlayer, cardName: targetZone[action.targetIndex]!.name })];
               targetZone[action.targetIndex] = null;
            }
          }
        }
      } else if (card.id === 'monster-reborn') {
        if (action.targetIndex !== undefined && action.targetPlayer) {
           const targetGy = action.targetPlayer === action.player ? newTurnGy : newOppGy;
           if (targetGy[action.targetIndex]) {
             const rebornCard = targetGy[action.targetIndex];
             targetGy.splice(action.targetIndex, 1);
             
             const emptyZoneIndex = newTurnZone.findIndex(z => z === null);
             if (emptyZoneIndex !== -1) {
               newTurnZone[emptyZoneIndex] = { ...rebornCard, position: 'attack', justSummoned: true };
               newState.log = [...newState.log, generateLog('SUMMON_MONSTER', { player: action.player, cardName: rebornCard.name })];
             }
           }
        }
      } else if (card.id === 'brain-control') {
        if (newTurnLp < 800) {
          newState.log = [...newState.log, generateLog('SYSTEM_MESSAGE', { message: 'Brain Control could not resolve because you do not have enough LP to pay its cost.' })];
        } else if (action.targetIndex !== undefined && action.targetPlayer === oppKey) {
          const targetMonster = newOppZone[action.targetIndex];
          const emptyZoneIndex = newTurnZone.findIndex(z => z === null);
          const canTakeControl = targetMonster && targetMonster.position !== 'set-monster' && !targetMonster.isFusion;
          if (canTakeControl && emptyZoneIndex !== -1) {
            newOppZone[action.targetIndex] = null;
            newTurnZone[emptyZoneIndex] = {
              ...targetMonster,
              originalOwner: oppKey,
              temporaryControl: true,
            };
            newTurnLp -= 800;
            if (newTurnLp === 0) {
              newState.winner = oppKey;
            }
            newState.log = [...newState.log, generateLog('SPELL_EFFECT', { player: action.player, effectType: 'brain-control', targetCardName: targetMonster.name })];
          } else {
            newState.log = [...newState.log, generateLog('SYSTEM_MESSAGE', { message: 'Brain Control could not resolve because there was no valid face-up target or no open monster zone.' })];
          }
        }
      } else if (card.id === 'de-spell') {
        if (action.targetIndex !== undefined && action.targetPlayer === oppKey) {
          if (newOppSTZone[action.targetIndex]) {
            const targetedCard = newOppSTZone[action.targetIndex]!;
            if (targetedCard.type === 'Spell') {
              newOppSTZone[action.targetIndex] = null;
              newOppGy.push(targetedCard);
              newState.log = [...newState.log, generateLog('SPELL_EFFECT', { player: action.player, effectType: 'de-spell', targetCardName: targetedCard.name })];
            } else {
              newState.log = [...newState.log, generateLog('SPELL_EFFECT', { player: action.player, effectType: 'de-spell-reveal', targetCardName: targetedCard.name })];
            }
          } else {
            newState.log = [...newState.log, generateLog('SYSTEM_MESSAGE', { message: 'De-Spell had no valid Spell/Trap target.' })];
          }
        }
      } else {
        newState.log = [...newState.log, generateLog('SYSTEM_MESSAGE', { message: `The effect of ${card.name} is not implemented yet.` })];
      }

      newTurnGy.push(card);

      newState[action.player] = { ...pState, hand: newHand, spellTrapZone: newSpellZone, graveyard: newTurnGy, monsterZone: newTurnZone, lp: newTurnLp };
      newState[oppKey] = { ...oppState, lp: newOppLp, monsterZone: newOppZone, graveyard: newOppGy, spellTrapZone: newOppSTZone };

      return newState;
    }
    case 'ACTIVATE_TRAP': {
      const pState = state[action.player];
      const oppKey = action.player === 'player' ? 'opponent' : 'player';
      const oppState = state[oppKey];
      
      let card: GameCard;
      let newSpellZone = [...pState.spellTrapZone];
      
      if (action.fromZone !== undefined) {
        card = newSpellZone[action.fromZone]!;
        newSpellZone[action.fromZone] = null;
      } else {
        return state;
      }

      let newState = { ...state };
      let newOppSTZone = [...oppState.spellTrapZone];
      let newOppGy = [...oppState.graveyard];
      let newTurnGy = [...pState.graveyard];

      newState.log = [...newState.log, generateLog('ACTIVATE_TRAP', { player: action.player, cardName: card.name })];

      if (card.id === 'dust-tornado') {
        if (action.targetIndex !== undefined && action.targetPlayer === oppKey) {
          if (newOppSTZone[action.targetIndex]) {
            const destroyedCard = newOppSTZone[action.targetIndex]!;
            newOppSTZone[action.targetIndex] = null;
            newOppGy.push(destroyedCard);
            newState.log = [...newState.log, generateLog('SPELL_EFFECT', { player: action.player, effectType: 'dust-tornado', targetCardName: destroyedCard.name })];
          }
        }
      } else {
        newState.log = [...newState.log, generateLog('SYSTEM_MESSAGE', { message: `The effect of ${card.name} is not implemented yet.` })];
      }

      newTurnGy.push(card);

      newState[action.player] = { ...pState, spellTrapZone: newSpellZone, graveyard: newTurnGy };
      newState[oppKey] = { ...oppState, spellTrapZone: newOppSTZone, graveyard: newOppGy };

      return newState;
    }
    default:
      return state;
  }
}
