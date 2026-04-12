import { CARD_DB } from '../constants';
import { generateLog, type LogActionType } from '../utils/logGenerator';
import type { Card, GameCard, GameState, PlayerState } from '../types';
import type {
  ActivationContext,
  CardActionAvailability,
  CardAiHints,
  CardEffectRegistryEntry,
  CardPreview,
  CardResolverContext,
  CardSupportMeta,
  CompetitionAiProfile,
  ResponseTriggerContext,
  ResponseWindowOption,
  TriggeredEffectResolutionContext,
} from './types';

const MAIN_PHASES = ['M1', 'M2'] as const;

type ActivateCardEffectAction = {
  type: 'ACTIVATE_SPELL' | 'ACTIVATE_TRAP';
  player: 'player' | 'opponent';
  cardInstanceId: string;
  fromZone?: number;
  discardInstanceId?: string;
  targetIndex?: number;
  targetPlayer?: 'player' | 'opponent';
};

type PendingLogEntry = {
  type: LogActionType;
  data?: any;
};

const hasEmptyMonsterZone = (player: PlayerState) => player.monsterZone.some(zone => zone === null);
const hasEmptySpellTrapZone = (player: PlayerState) => player.spellTrapZone.some(zone => zone === null);

const getTributeRequirement = (level?: number) => {
  if (!level || level <= 4) return 0;
  if (level <= 6) return 1;
  return 2;
};

const hasSpecialSummonOnlyText = (card: Card) => {
  const description = card.description.toLowerCase();
  return (
    description.includes('cannot be normal summoned/set') ||
    description.includes('cannot be normal summoned or set') ||
    description.includes('must be special summoned') ||
    description.includes('cannot be normal summon') ||
    description.includes('cannot be normal set')
  );
};

const inferMonsterSupportStatus = (card: Card) => {
  if (card.effectSupportStatus) return card.effectSupportStatus;
  if (card.isFusion) return 'implemented' as const;
  if (hasSpecialSummonOnlyText(card)) return 'partial' as const;

  const effectLikeText = /(once per|special summon|destroy|inflict|draw|banish|tribute|return|negate|cannot|when |if |during )/i;
  return effectLikeText.test(card.description) ? ('partial' as const) : ('implemented' as const);
};

const buildDefaultAiHints = (card: Card): CardAiHints => {
  if (card.type === 'Monster') {
    return {
      basePriority: Math.max(1, Math.round((card.atk || 0) / 400)),
      signatureWeight: card.level && card.level >= 7 ? 2 : 0,
      tags: (card.atk || 0) >= 1800 ? ['aggressive'] : [],
    };
  }

  if (card.type === 'Trap') {
    return {
      basePriority: 1,
      signatureWeight: 0,
      tags: ['backrow'],
    };
  }

  return {
    basePriority: 1,
    signatureWeight: 0,
    tags: [],
  };
};

const buildDefaultEntry = (card: Card): CardEffectRegistryEntry => {
  if (card.type === 'Monster') {
    const specialSummonOnly = hasSpecialSummonOnlyText(card);
    const supportStatus = inferMonsterSupportStatus(card);
    return {
      id: card.id,
      supportStatus,
      supportNote: card.effectSupportNote || (
        specialSummonOnly
          ? 'Printed summon restriction is enforced. Monster effect text beyond summon rules is not fully implemented.'
          : undefined
      ),
      playRules: {
        canNormalSummon: !card.isFusion && !specialSummonOnly,
        canSetMonster: !card.isFusion && !specialSummonOnly,
        tributeRequirement: getTributeRequirement(card.level),
        summonRestrictionText: specialSummonOnly ? 'Must be Special Summoned according to its printed effect.' : undefined,
      },
      aiHints: buildDefaultAiHints(card),
    };
  }

  const trapDefault = card.type === 'Trap';

  return {
    id: card.id,
    supportStatus: card.effectSupportStatus || 'unsupported',
    supportNote: card.effectSupportNote || `${card.type} effect is not implemented yet.`,
    playRules: {
      canNormalSummon: false,
      canSetMonster: false,
    },
    activationRules: {
      canActivateFromHand: !trapDefault,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
    },
    aiHints: buildDefaultAiHints(card),
  };
};

export const isMaterialMatch = (card: GameCard, requirement: string): boolean => {
  const req = requirement.toLowerCase().trim();
  const cardName = card.name.toLowerCase();

  if (cardName.includes(req) || req.includes(cardName)) return true;

  if (req.includes('dinosaur or dragon monster')) {
    return card.type === 'Monster' && (card.subType?.includes('Dinosaur') || card.subType?.includes('Dragon') || false);
  }

  const attrMatch = req.match(/1 ([a-z]+) monster/);
  if (attrMatch) {
    const value = attrMatch[1];
    if (card.attribute?.toLowerCase() === value) return true;
    if (card.subType?.toLowerCase().includes(value)) return true;
  }

  return false;
};

export const getPossibleFusionMonsters = (player: PlayerState): GameCard[] => {
  const fusionMonsters = player.extraDeck.filter(card => card.isFusion);

  return fusionMonsters.filter(fusionMonster => {
    if (!fusionMonster.fusionMaterials) return false;

    const availableCards = [...player.hand, ...player.monsterZone.filter(Boolean)] as GameCard[];
    const tempAvailable = [...availableCards];
    let hasAllMaterials = true;
    let fieldMaterialsUsed = 0;

    for (const materialName of fusionMonster.fusionMaterials) {
      const materialIndex = tempAvailable.findIndex(card => isMaterialMatch(card, materialName));
      if (materialIndex === -1) {
        hasAllMaterials = false;
        break;
      }

      if (player.monsterZone.some(monster => monster?.instanceId === tempAvailable[materialIndex].instanceId)) {
        fieldMaterialsUsed += 1;
      }
      tempAvailable.splice(materialIndex, 1);
    }

    return hasAllMaterials && (hasEmptyMonsterZone(player) || fieldMaterialsUsed > 0);
  });
};

const findWeakestFaceUpMonsterIndex = (zone: (GameCard | null)[]) => {
  let lowestAtk = Infinity;
  let targetIndex = -1;

  zone.forEach((monster, index) => {
    if (monster && monster.position !== 'set-monster' && (monster.atk || 0) < lowestAtk) {
      lowestAtk = monster.atk || 0;
      targetIndex = index;
    }
  });

  return targetIndex;
};

const appendLog = (context: CardResolverContext, type: LogActionType, data?: any) => {
  context.log.push({ type, data });
};

const buildResolvedState = (
  state: GameState,
  playerKey: 'player' | 'opponent',
  opponentKey: 'player' | 'opponent',
  context: CardResolverContext,
) => ({
  ...state,
  winner: context.winner,
  [playerKey]: {
    ...state[playerKey],
    hand: context.hand,
    deck: context.playerDeck,
    monsterZone: context.playerMonsterZone,
    spellTrapZone: context.playerSpellTrapZone,
    graveyard: context.playerGraveyard,
    lp: context.playerLp,
  },
  [opponentKey]: {
    ...state[opponentKey],
    monsterZone: context.opponentMonsterZone,
    spellTrapZone: context.opponentSpellTrapZone,
    graveyard: context.opponentGraveyard,
    lp: context.opponentLp,
  },
  log: [...state.log, ...context.log.map(entry => generateLog(entry.type as LogActionType, entry.data))],
});

const finalizeTriggeredResolution = (
  state: GameState,
  responder: 'player' | 'opponent',
  opponentKey: 'player' | 'opponent',
  spellTrapZone: (GameCard | null)[],
  responderGraveyard: GameCard[],
  responderMonsterZone?: (GameCard | null)[],
  responderLp?: number,
  opponentMonsterZone?: (GameCard | null)[],
  opponentGraveyard?: GameCard[],
  opponentLp?: number,
  winner?: GameState['winner'],
  phase?: GameState['phase'],
  logs?: PendingLogEntry[],
) => ({
  ...state,
  phase: phase ?? state.phase,
  winner: winner ?? state.winner,
  [responder]: {
    ...state[responder],
    spellTrapZone,
    graveyard: responderGraveyard,
    monsterZone: responderMonsterZone ?? state[responder].monsterZone,
    lp: responderLp ?? state[responder].lp,
  },
  [opponentKey]: {
    ...state[opponentKey],
    monsterZone: opponentMonsterZone ?? state[opponentKey].monsterZone,
    graveyard: opponentGraveyard ?? state[opponentKey].graveyard,
    lp: opponentLp ?? state[opponentKey].lp,
  },
  log: logs ? [...state.log, ...logs.map(entry => generateLog(entry.type, entry.data))] : state.log,
});

const overrideEntries: Record<string, Partial<CardEffectRegistryEntry>> = {
  'dark-hole': {
    supportStatus: 'implemented',
    supportNote: 'Fully supported field wipe.',
    activationRules: {
      canActivateFromHand: true,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
    },
    targetRules: [],
    aiHints: { basePriority: 6, signatureWeight: 1, tags: ['removal', 'comeback'] },
    canActivate: (_card, context) => context.player.monsterZone.some(Boolean) || context.opponent.monsterZone.some(Boolean),
    resolveActivated: (context) => {
      context.opponentMonsterZone.forEach(monster => monster && context.opponentGraveyard.push(monster));
      context.playerMonsterZone.forEach(monster => monster && context.playerGraveyard.push(monster));
      context.opponentMonsterZone = [null, null, null, null, null];
      context.playerMonsterZone = [null, null, null, null, null];
      appendLog(context, 'SPELL_EFFECT', { player: context.playerKey, effectType: 'dark-hole' });
    },
  },
  raigeki: {
    supportStatus: 'implemented',
    activationRules: {
      canActivateFromHand: true,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
    },
    targetRules: [],
    aiHints: { basePriority: 6, signatureWeight: 0, tags: ['removal'] },
    canActivate: (_card, context) => context.opponent.monsterZone.some(Boolean),
    resolveActivated: (context) => {
      context.opponentMonsterZone.forEach(monster => monster && context.opponentGraveyard.push(monster));
      context.opponentMonsterZone = [null, null, null, null, null];
      appendLog(context, 'SPELL_EFFECT', { player: context.playerKey, effectType: 'raigeki' });
    },
  },
  fissure: {
    supportStatus: 'implemented',
    activationRules: {
      canActivateFromHand: true,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
    },
    targetRules: [
      {
        zones: ['monster-zone'],
        owner: 'opponent',
        kind: 'monster',
        minTargets: 1,
        maxTargets: 1,
        description: 'Destroys the lowest-ATK face-up monster your opponent controls.',
      },
    ],
    aiHints: { basePriority: 4, signatureWeight: 0, tags: ['removal'] },
    canActivate: (_card, context) => context.opponent.monsterZone.some(monster => monster !== null && monster.position !== 'set-monster'),
    resolveActivated: (context) => {
      const targetIndex = findWeakestFaceUpMonsterIndex(context.opponentMonsterZone);
      if (targetIndex === -1) {
        appendLog(context, 'SPELL_EFFECT', { player: context.playerKey, effectType: 'fissure-fail' });
        return;
      }

      const destroyedCard = context.opponentMonsterZone[targetIndex]!;
      context.opponentGraveyard.push(destroyedCard);
      context.opponentMonsterZone[targetIndex] = null;
      appendLog(context, 'MONSTER_DESTROYED', { player: context.opponentKey, cardName: destroyedCard.name });
    },
  },
  hinotama: {
    supportStatus: 'implemented',
    activationRules: {
      canActivateFromHand: true,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
    },
    aiHints: { basePriority: 3, signatureWeight: 0, tags: ['burn', 'aggressive'] },
    canActivate: () => true,
    resolveActivated: (context) => {
      context.opponentLp = Math.max(0, context.opponentLp - 500);
      appendLog(context, 'BATTLE_DAMAGE', {
        player: context.opponentKey,
        damage: 500,
        cardName: context.card.name,
        remainingLp: context.opponentLp,
        isLethal: context.opponentLp === 0,
      });
      if (context.opponentLp === 0) {
        context.winner = context.playerKey;
      }
    },
  },
  'pot-of-greed': {
    supportStatus: 'implemented',
    activationRules: {
      canActivateFromHand: true,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
    },
    aiHints: { basePriority: 5, signatureWeight: 0, tags: ['draw'] },
    canActivate: (_card, context) => context.player.deck.length >= 2,
    resolveActivated: (context) => {
      for (let i = 0; i < 2; i += 1) {
        const drawnCard = context.playerDeck.pop();
        if (drawnCard) {
          context.hand.push(drawnCard);
        }
      }
      appendLog(context, 'SPELL_EFFECT', { player: context.playerKey, effectType: 'pot-of-greed' });
    },
  },
  'harpie-s-feather-duster': {
    supportStatus: 'implemented',
    activationRules: {
      canActivateFromHand: true,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
    },
    aiHints: { basePriority: 5, signatureWeight: 1, tags: ['backrow', 'removal'] },
    canActivate: (_card, context) => context.opponent.spellTrapZone.some(Boolean),
    resolveActivated: (context) => {
      context.opponentSpellTrapZone.forEach(spellTrap => spellTrap && context.opponentGraveyard.push(spellTrap));
      context.opponentSpellTrapZone = [null, null, null, null, null];
      appendLog(context, 'SPELL_EFFECT', { player: context.playerKey, effectType: 'harpies-feather-duster' });
    },
  },
  'tribute-to-the-doomed': {
    supportStatus: 'implemented',
    activationRules: {
      canActivateFromHand: true,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
      targetLabel: 'Discard 1 card, then destroy 1 monster.',
    },
    targetRules: [
      {
        zones: ['monster-zone'],
        owner: 'either',
        kind: 'monster',
        minTargets: 1,
        maxTargets: 1,
        description: 'Destroy 1 monster on the field after discarding a card.',
      },
    ],
    aiHints: { basePriority: 4, signatureWeight: 0, tags: ['removal'] },
    canActivate: (_card, context, fromZone) => {
      const discardableCards = context.player.hand.length - (fromZone === undefined ? 1 : 0);
      const hasMonsterTarget = context.player.monsterZone.some(Boolean) || context.opponent.monsterZone.some(Boolean);
      return discardableCards >= 1 && hasMonsterTarget;
    },
    resolveActivated: (context) => {
      if (!context.discardInstanceId || context.targetIndex === undefined || !context.targetPlayer) return;

      const discardIndex = context.hand.findIndex(card => card.instanceId === context.discardInstanceId);
      if (discardIndex === -1) return;

      const discardedCard = context.hand[discardIndex];
      context.hand.splice(discardIndex, 1);
      context.playerGraveyard.push(discardedCard);

      const targetZone = context.targetPlayer === context.playerKey ? context.playerMonsterZone : context.opponentMonsterZone;
      const targetGraveyard = context.targetPlayer === context.playerKey ? context.playerGraveyard : context.opponentGraveyard;
      const targetCard = targetZone[context.targetIndex];
      if (!targetCard) return;

      targetGraveyard.push(targetCard);
      targetZone[context.targetIndex] = null;
      appendLog(context, 'MONSTER_DESTROYED', { player: context.targetPlayer, cardName: targetCard.name });
    },
  },
  'monster-reborn': {
    supportStatus: 'implemented',
    activationRules: {
      canActivateFromHand: true,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
      targetLabel: 'Select a monster in either Graveyard.',
    },
    targetRules: [
      {
        zones: ['graveyard'],
        owner: 'either',
        kind: 'monster',
        minTargets: 1,
        maxTargets: 1,
        description: 'Special Summon 1 monster from either Graveyard.',
      },
    ],
    aiHints: { basePriority: 5, signatureWeight: 1, tags: ['revive', 'comeback'] },
    canActivate: (_card, context) => {
      const anyMonsterInGraveyard =
        context.player.graveyard.some(cardInGy => cardInGy.type === 'Monster') ||
        context.opponent.graveyard.some(cardInGy => cardInGy.type === 'Monster');
      return hasEmptyMonsterZone(context.player) && anyMonsterInGraveyard;
    },
    resolveActivated: (context) => {
      if (context.targetIndex === undefined || !context.targetPlayer) return;

      const sourceGraveyard = context.targetPlayer === context.playerKey ? context.playerGraveyard : context.opponentGraveyard;
      const targetCard = sourceGraveyard[context.targetIndex];
      const emptyZoneIndex = context.playerMonsterZone.findIndex(zone => zone === null);
      if (!targetCard || emptyZoneIndex === -1 || targetCard.type !== 'Monster') return;

      sourceGraveyard.splice(context.targetIndex, 1);
      context.playerMonsterZone[emptyZoneIndex] = { ...targetCard, position: 'attack', justSummoned: true };
      appendLog(context, 'SUMMON_MONSTER', { player: context.playerKey, cardName: targetCard.name });
    },
  },
  'brain-control': {
    supportStatus: 'implemented',
    activationRules: {
      canActivateFromHand: true,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
      targetLabel: 'Select an opponent face-up monster to take control of.',
    },
    targetRules: [
      {
        zones: ['monster-zone'],
        owner: 'opponent',
        kind: 'monster',
        minTargets: 1,
        maxTargets: 1,
        description: 'Take control of 1 face-up opponent monster until the End Phase.',
      },
    ],
    aiHints: { basePriority: 4, signatureWeight: 1, tags: ['steal', 'aggressive'] },
    canActivate: (_card, context) => {
      const hasTarget = context.opponent.monsterZone.some(monster => monster !== null && monster.position !== 'set-monster' && !monster.isFusion);
      return context.player.lp >= 800 && hasEmptyMonsterZone(context.player) && hasTarget;
    },
    resolveActivated: (context) => {
      if (context.playerLp < 800) {
        appendLog(context, 'SYSTEM_MESSAGE', {
          message: 'Brain Control could not resolve because you do not have enough LP to pay its cost.',
        });
        return;
      }

      if (context.targetIndex === undefined || context.targetPlayer !== context.opponentKey) return;

      const targetMonster = context.opponentMonsterZone[context.targetIndex];
      const emptyZoneIndex = context.playerMonsterZone.findIndex(zone => zone === null);
      const canTakeControl = targetMonster && targetMonster.position !== 'set-monster' && !targetMonster.isFusion;
      if (!canTakeControl || emptyZoneIndex === -1) {
        appendLog(context, 'SYSTEM_MESSAGE', {
          message: 'Brain Control could not resolve because there was no valid face-up target or no open monster zone.',
        });
        return;
      }

      context.opponentMonsterZone[context.targetIndex] = null;
      context.playerMonsterZone[emptyZoneIndex] = {
        ...targetMonster,
        originalOwner: context.opponentKey,
        temporaryControl: true,
      };
      context.playerLp = Math.max(0, context.playerLp - 800);
      appendLog(context, 'SPELL_EFFECT', {
        player: context.playerKey,
        effectType: 'brain-control',
        targetCardName: targetMonster.name,
      });
      if (context.playerLp === 0) {
        context.winner = context.opponentKey;
      }
    },
  },
  'de-spell': {
    supportStatus: 'implemented',
    activationRules: {
      canActivateFromHand: true,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
      targetLabel: 'Select an opponent Spell card.',
    },
    targetRules: [
      {
        zones: ['spell-trap-zone'],
        owner: 'opponent',
        kind: 'spell',
        minTargets: 1,
        maxTargets: 1,
        description: 'Destroy a targeted Spell card or reveal a Set Trap.',
      },
    ],
    aiHints: { basePriority: 3, signatureWeight: 0, tags: ['backrow', 'removal'] },
    canActivate: (_card, context) => context.opponent.spellTrapZone.some(zoneCard => zoneCard?.type === 'Spell'),
    resolveActivated: (context) => {
      if (context.targetIndex === undefined || context.targetPlayer !== context.opponentKey) return;
      const targetCard = context.opponentSpellTrapZone[context.targetIndex];
      if (!targetCard) {
        appendLog(context, 'SYSTEM_MESSAGE', { message: 'De-Spell had no valid Spell/Trap target.' });
        return;
      }

      if (targetCard.type === 'Spell') {
        context.opponentSpellTrapZone[context.targetIndex] = null;
        context.opponentGraveyard.push(targetCard);
        appendLog(context, 'SPELL_EFFECT', { player: context.playerKey, effectType: 'de-spell', targetCardName: targetCard.name });
        return;
      }

      appendLog(context, 'SPELL_EFFECT', { player: context.playerKey, effectType: 'de-spell-reveal', targetCardName: targetCard.name });
    },
  },
  polymerization: {
    supportStatus: 'implemented',
    activationRules: {
      canActivateFromHand: true,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
      targetLabel: 'Select a Fusion Monster and its materials.',
    },
    targetRules: [
      {
        zones: ['extra-deck'],
        owner: 'player',
        kind: 'fusion-monster',
        minTargets: 1,
        maxTargets: 1,
        description: 'Fusion Summon 1 valid Fusion Monster from your Extra Deck.',
      },
    ],
    aiHints: { basePriority: 4, signatureWeight: 1, tags: ['fusion'] },
    canActivate: (_card, context) => getPossibleFusionMonsters(context.player).length > 0,
  },
  'dust-tornado': {
    supportStatus: 'implemented',
    activationRules: {
      canActivateFromHand: false,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
      targetLabel: 'Select an opponent Spell/Trap to destroy.',
    },
    targetRules: [
      {
        zones: ['spell-trap-zone'],
        owner: 'opponent',
        kind: 'spell-trap',
        minTargets: 1,
        maxTargets: 1,
        description: 'Destroy 1 Spell/Trap your opponent controls.',
      },
    ],
    aiHints: { basePriority: 3, signatureWeight: 0, tags: ['backrow', 'reactive'] },
    canActivate: (_card, context) => context.opponent.spellTrapZone.some(Boolean),
    resolveActivated: (context) => {
      if (context.targetIndex === undefined || context.targetPlayer !== context.opponentKey) return;
      const targetCard = context.opponentSpellTrapZone[context.targetIndex];
      if (!targetCard) return;

      context.opponentSpellTrapZone[context.targetIndex] = null;
      context.opponentGraveyard.push(targetCard);
      appendLog(context, 'SPELL_EFFECT', { player: context.playerKey, effectType: 'dust-tornado', targetCardName: targetCard.name });
    },
  },
  'trap-hole': {
    supportStatus: 'implemented',
    activationRules: {
      canActivateFromHand: false,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
    },
    aiHints: { basePriority: 2, signatureWeight: 0, tags: ['reactive', 'removal'] },
    getResponseWindow: (card, fromZone, trigger) => {
      if (
        trigger.type !== 'monster_summoned' ||
        trigger.position !== 'attack' ||
        (trigger.summonedCard.atk || 0) < 1000
      ) {
        return null;
      }

      return {
        card,
        fromZone,
        title: 'Activate Trap Hole',
        description: `Destroy ${trigger.summonedCard.name} before it can stay on the field.`,
      };
    },
    resolveTriggered: (context) => {
      if (context.trigger.type !== 'monster_summoned') return context.state;

      const responderState = context.state[context.responder];
      const opponentKey = context.responder === 'player' ? 'opponent' : 'player';
      const actedState = context.state[opponentKey];
      const trapCard = responderState.spellTrapZone[context.fromZone];
      const targetCard = actedState.monsterZone[context.trigger.zoneIndex];
      if (!trapCard || !targetCard) return context.state;

      const newSpellTrapZone = [...responderState.spellTrapZone];
      const newResponderGraveyard = [...responderState.graveyard, trapCard];
      newSpellTrapZone[context.fromZone] = null;

      const newOpponentMonsterZone = [...actedState.monsterZone];
      const newOpponentGraveyard = [...actedState.graveyard, targetCard];
      newOpponentMonsterZone[context.trigger.zoneIndex] = null;

      return finalizeTriggeredResolution(
        context.state,
        context.responder,
        opponentKey,
        newSpellTrapZone,
        newResponderGraveyard,
        undefined,
        undefined,
        newOpponentMonsterZone,
        newOpponentGraveyard,
        undefined,
        undefined,
        undefined,
        [
          ...(context.preEffectLogs || []),
          { type: 'ACTIVATE_TRAP', data: { player: context.responder, cardName: trapCard.name } },
          { type: 'MONSTER_DESTROYED', data: { player: opponentKey, cardName: targetCard.name } },
        ],
      );
    },
  },
  'mirror-force': {
    supportStatus: 'implemented',
    activationRules: {
      canActivateFromHand: false,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
    },
    aiHints: { basePriority: 3, signatureWeight: 0, tags: ['reactive', 'removal', 'backrow'] },
    getResponseWindow: (card, fromZone, trigger) => {
      if (trigger.type !== 'attack_declared') return null;
      return {
        card,
        fromZone,
        title: 'Activate Mirror Force',
        description: 'Destroy all of your opponent\'s Attack Position monsters.',
      };
    },
    resolveTriggered: (context) => {
      if (context.trigger.type !== 'attack_declared') return context.state;

      const responderState = context.state[context.responder];
      const opponentKey = context.responder === 'player' ? 'opponent' : 'player';
      const attackingState = context.state[opponentKey];
      const trapCard = responderState.spellTrapZone[context.fromZone];
      if (!trapCard) return context.state;

      const newSpellTrapZone = [...responderState.spellTrapZone];
      const newResponderGraveyard = [...responderState.graveyard, trapCard];
      newSpellTrapZone[context.fromZone] = null;

      const newAttackingMonsterZone = [...attackingState.monsterZone];
      const newAttackingGraveyard = [...attackingState.graveyard];
      newAttackingMonsterZone.forEach((monster, index) => {
        if (monster && monster.position === 'attack') {
          newAttackingGraveyard.push(monster);
          newAttackingMonsterZone[index] = null;
        }
      });

      return finalizeTriggeredResolution(
        context.state,
        context.responder,
        opponentKey,
        newSpellTrapZone,
        newResponderGraveyard,
        undefined,
        undefined,
        newAttackingMonsterZone,
        newAttackingGraveyard,
        undefined,
        undefined,
        undefined,
        [
          ...(context.preEffectLogs || []),
          { type: 'ACTIVATE_TRAP', data: { player: context.responder, cardName: trapCard.name } },
          { type: 'MONSTER_DESTROYED', data: { player: opponentKey, cardName: 'All Attack Position monsters' } },
        ],
      );
    },
  },
  'magic-cylinder': {
    supportStatus: 'implemented',
    activationRules: {
      canActivateFromHand: false,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
    },
    aiHints: { basePriority: 3, signatureWeight: 0, tags: ['reactive', 'burn'] },
    getResponseWindow: (card, fromZone, trigger) => {
      if (trigger.type !== 'attack_declared') return null;
      return {
        card,
        fromZone,
        title: 'Activate Magic Cylinder',
        description: `Negate ${trigger.attacker.name}'s attack and inflict ${trigger.attacker.atk || 0} damage.`,
      };
    },
    resolveTriggered: (context) => {
      if (context.trigger.type !== 'attack_declared') return context.state;

      const responderState = context.state[context.responder];
      const opponentKey = context.responder === 'player' ? 'opponent' : 'player';
      const attackingState = context.state[opponentKey];
      const trapCard = responderState.spellTrapZone[context.fromZone];
      if (!trapCard) return context.state;

      const newSpellTrapZone = [...responderState.spellTrapZone];
      const newResponderGraveyard = [...responderState.graveyard, trapCard];
      newSpellTrapZone[context.fromZone] = null;

      const newOpponentLp = Math.max(0, attackingState.lp - (context.trigger.attacker.atk || 0));

      return finalizeTriggeredResolution(
        context.state,
        context.responder,
        opponentKey,
        newSpellTrapZone,
        newResponderGraveyard,
        undefined,
        undefined,
        undefined,
        undefined,
        newOpponentLp,
        newOpponentLp === 0 ? context.responder : context.state.winner,
        undefined,
        [
          ...(context.preEffectLogs || []),
          { type: 'ACTIVATE_TRAP', data: { player: context.responder, cardName: trapCard.name } },
          {
            type: 'BATTLE_DAMAGE',
            data: {
              player: opponentKey,
              damage: context.trigger.attacker.atk || 0,
              cardName: trapCard.name,
              remainingLp: newOpponentLp,
              isLethal: newOpponentLp === 0,
            },
          },
        ],
      );
    },
  },
  'negate-attack': {
    supportStatus: 'implemented',
    activationRules: {
      canActivateFromHand: false,
      canActivateWhenSet: true,
      legalPhases: [...MAIN_PHASES],
    },
    aiHints: { basePriority: 2, signatureWeight: 0, tags: ['reactive'] },
    getResponseWindow: (card, fromZone, trigger) => {
      if (trigger.type !== 'attack_declared') return null;
      return {
        card,
        fromZone,
        title: 'Activate Negate Attack',
        description: 'Negate the attack and immediately end the Battle Phase.',
      };
    },
    resolveTriggered: (context) => {
      if (context.trigger.type !== 'attack_declared') return context.state;

      const responderState = context.state[context.responder];
      const opponentKey = context.responder === 'player' ? 'opponent' : 'player';
      const trapCard = responderState.spellTrapZone[context.fromZone];
      if (!trapCard) return context.state;

      const newSpellTrapZone = [...responderState.spellTrapZone];
      const newResponderGraveyard = [...responderState.graveyard, trapCard];
      newSpellTrapZone[context.fromZone] = null;

      return finalizeTriggeredResolution(
        context.state,
        context.responder,
        opponentKey,
        newSpellTrapZone,
        newResponderGraveyard,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'M2',
        [
          ...(context.preEffectLogs || []),
          { type: 'ACTIVATE_TRAP', data: { player: context.responder, cardName: trapCard.name } },
          { type: 'SYSTEM_MESSAGE', data: { message: 'The attack was negated and the Battle Phase ended.' } },
        ],
      );
    },
  },
};

const buildEffectRegistry = () => Object.fromEntries(
  Object.values(CARD_DB).map((card) => {
    const baseEntry = buildDefaultEntry(card);
    return [
      card.id,
      {
        ...baseEntry,
        ...(overrideEntries[card.id] || {}),
        playRules: {
          ...baseEntry.playRules,
          ...(overrideEntries[card.id]?.playRules || {}),
        },
        activationRules: overrideEntries[card.id]?.activationRules
          ? {
              ...(baseEntry.activationRules || {}),
              ...overrideEntries[card.id]!.activationRules!,
            }
          : baseEntry.activationRules,
        aiHints: {
          ...baseEntry.aiHints,
          ...(overrideEntries[card.id]?.aiHints || {}),
        },
        targetRules: overrideEntries[card.id]?.targetRules ?? baseEntry.targetRules,
      } satisfies CardEffectRegistryEntry,
    ];
  }),
) as Record<string, CardEffectRegistryEntry>;

let effectRegistry = buildEffectRegistry();

export const rebuildEffectRegistry = () => {
  effectRegistry = buildEffectRegistry();
  return effectRegistry;
};

const getDefaultEntryFromCard = (cardId: string): CardEffectRegistryEntry => {
  const card = CARD_DB[cardId];
  if (!card) {
    return {
      id: cardId,
      supportStatus: 'unsupported',
      supportNote: 'Card data is missing from the registry.',
      playRules: {
        canNormalSummon: false,
        canSetMonster: false,
      },
      aiHints: { basePriority: 0, signatureWeight: 0, tags: [] },
    };
  }
  return buildDefaultEntry(card);
};

export const getCardEffectEntry = (cardId: string) => effectRegistry[cardId] ?? getDefaultEntryFromCard(cardId);

export const getCardSupportMeta = (card: Pick<Card, 'id' | 'type'>): CardSupportMeta => {
  const entry = getCardEffectEntry(card.id);
  const label = entry.supportStatus === 'implemented'
    ? 'Effect Supported'
    : entry.supportStatus === 'partial'
      ? 'Support Partial'
      : 'Support Unsupported';

  return {
    status: entry.supportStatus,
    label,
    note: entry.supportNote,
  };
};

export const getCardAiHints = (cardId: string) => getCardEffectEntry(cardId).aiHints;

export const canActivateCard = (
  card: Pick<GameCard, 'id' | 'instanceId'>,
  context: ActivationContext,
  fromZone?: number,
) => {
  const entry = getCardEffectEntry(card.id);
  if (!entry.activationRules) return false;
  if (context.phase && !entry.activationRules.legalPhases.includes(context.phase)) return false;
  return entry.canActivate ? entry.canActivate(card, context, fromZone) : false;
};

export const getHandCardActionAvailability = (
  card: GameCard,
  context: ActivationContext,
): CardActionAvailability => {
  const entry = getCardEffectEntry(card.id);

  if (card.type === 'Monster') {
    const tributeRequirement = entry.playRules.tributeRequirement ?? getTributeRequirement(card.level);
    const availableTributes = context.player.monsterZone.filter(Boolean).length;
    const canNormalSummonOrSet =
      !context.normalSummonUsed &&
      availableTributes >= tributeRequirement &&
      (hasEmptyMonsterZone(context.player) || tributeRequirement > 0);

    return {
      summon: entry.playRules.canNormalSummon && canNormalSummonOrSet,
      setMonster: entry.playRules.canSetMonster && canNormalSummonOrSet,
      activate: false,
      setSpellTrap: false,
    };
  }

  if (card.type === 'Spell') {
    return {
      summon: false,
      setMonster: false,
      activate: !!entry.activationRules?.canActivateFromHand && canActivateCard(card, context),
      setSpellTrap: hasEmptySpellTrapZone(context.player),
    };
  }

  return {
    summon: false,
    setMonster: false,
    activate: false,
    setSpellTrap: hasEmptySpellTrapZone(context.player),
  };
};

export const canActivateSetCard = (
  card: GameCard,
  context: ActivationContext,
): boolean => {
  const entry = getCardEffectEntry(card.id);
  if (!entry.activationRules?.canActivateWhenSet) return false;
  return canActivateCard(card, context, 0);
};

export const getResponseWindowOptions = (
  player: PlayerState,
  context: ActivationContext,
  trigger: ResponseTriggerContext,
): ResponseWindowOption[] =>
  player.spellTrapZone.flatMap((card, fromZone) => {
    if (!card || card.position !== 'set-spell') return [];
    const entry = getCardEffectEntry(card.id);
    const option = entry.getResponseWindow?.(card, fromZone, trigger, context);
    return option ? [option] : [];
  });

export const resolveActivatedCardEffect = (
  state: GameState,
  action: ActivateCardEffectAction,
): GameState => {
  const playerState = state[action.player];
  const opponentKey = action.player === 'player' ? 'opponent' : 'player';
  const opponentState = state[opponentKey];

  let card: GameCard | null = null;
  const hand = [...playerState.hand];
  const playerSpellTrapZone = [...playerState.spellTrapZone];

  if (action.fromZone !== undefined) {
    card = playerSpellTrapZone[action.fromZone];
    if (!card) return state;
    playerSpellTrapZone[action.fromZone] = null;
  } else {
    const handIndex = hand.findIndex(entry => entry.instanceId === action.cardInstanceId);
    if (handIndex === -1) return state;
    card = hand[handIndex];
    hand.splice(handIndex, 1);
  }

  const context: CardResolverContext = {
    state,
    playerKey: action.player,
    opponentKey,
    card,
    fromZone: action.fromZone,
    targetIndex: action.targetIndex,
    targetPlayer: action.targetPlayer,
    discardInstanceId: action.discardInstanceId,
    playerState,
    opponentState,
    hand,
    playerMonsterZone: [...playerState.monsterZone],
    playerSpellTrapZone,
    playerGraveyard: [...playerState.graveyard, card],
    playerDeck: [...playerState.deck],
    opponentMonsterZone: [...opponentState.monsterZone],
    opponentSpellTrapZone: [...opponentState.spellTrapZone],
    opponentGraveyard: [...opponentState.graveyard],
    playerLp: playerState.lp,
    opponentLp: opponentState.lp,
    winner: state.winner,
    log: [{ type: action.type, data: { player: action.player, cardName: card.name } }],
  };

  const entry = getCardEffectEntry(card.id);
  if (!entry.resolveActivated) {
    appendLog(context, 'SYSTEM_MESSAGE', { message: `The effect of ${card.name} is not implemented yet.` });
    return buildResolvedState(state, action.player, opponentKey, context);
  }

  entry.resolveActivated(context);
  return buildResolvedState(state, action.player, opponentKey, context);
};

export const resolveTriggeredResponse = (
  state: GameState,
  responder: 'player' | 'opponent',
  fromZone: number,
  trigger: ResponseTriggerContext,
  preEffectLogs?: PendingLogEntry[],
): GameState => {
  const responseCard = state[responder].spellTrapZone[fromZone];
  if (!responseCard) return state;

  const entry = getCardEffectEntry(responseCard.id);
  if (!entry.resolveTriggered) return state;

  return entry.resolveTriggered({
    state,
    responder,
    fromZone,
    trigger,
    preEffectLogs,
  });
};

export const getCompetitionAiScore = (
  card: GameCard,
  profile: CompetitionAiProfile | null | undefined,
  signatureCardIds: string[] = [],
  situation?: {
    isBehind?: boolean;
    opponentHasBackrow?: boolean;
    opponentHasMonsters?: boolean;
  },
) => {
  const entry = getCardEffectEntry(card.id);
  const aiHints = entry.aiHints;
  const resolvedProfile: CompetitionAiProfile = profile ?? {
    aggression: 0,
    signatureWeight: 0,
    removalBias: 0,
    backrowBias: 0,
    comebackBias: 0,
  };

  let score = aiHints.basePriority;
  if (signatureCardIds.includes(card.id)) {
    score += aiHints.signatureWeight * (1 + resolvedProfile.signatureWeight);
  }
  if (aiHints.tags.includes('aggressive')) score += resolvedProfile.aggression * 2;
  if (aiHints.tags.includes('removal')) score += resolvedProfile.removalBias * (situation?.opponentHasMonsters ? 2 : 0.5);
  if (aiHints.tags.includes('backrow')) score += resolvedProfile.backrowBias * (situation?.opponentHasBackrow ? 2 : 0.5);
  if (aiHints.tags.includes('comeback') && situation?.isBehind) score += resolvedProfile.comebackBias * 2;
  if (card.type === 'Monster') score += Math.max(0, (card.atk || 0) / 1000 - 1);

  return score;
};

export const buildCompetitionPreviewCard = (cardId: string): CardPreview => ({
  ...CARD_DB[cardId],
  instanceId: `preview-${cardId}`,
});
