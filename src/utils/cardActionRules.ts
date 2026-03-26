import { GameCard, PlayerState } from '../types';

export interface ActivationContext {
  player: PlayerState;
  opponent: PlayerState;
  normalSummonUsed: boolean;
}

export const isMaterialMatch = (card: GameCard, requirement: string): boolean => {
  const req = requirement.toLowerCase().trim();
  const cardName = card.name.toLowerCase();

  if (cardName.includes(req) || req.includes(cardName)) return true;

  if (req.includes('dinosaur or dragon monster')) {
    return card.type === 'Monster' && (card.subType?.includes('Dinosaur') || card.subType?.includes('Dragon') || false);
  }

  const attrMatch = req.match(/1 ([a-z]+) monster/);
  if (attrMatch) {
    const val = attrMatch[1];
    if (card.attribute?.toLowerCase() === val) return true;
    if (card.subType?.toLowerCase().includes(val)) return true;
  }

  return false;
};

export const getPossibleFusionMonsters = (player: PlayerState): GameCard[] => {
  const fusionMonsters = player.extraDeck.filter(c => c.isFusion);

  return fusionMonsters.filter(fm => {
    if (!fm.fusionMaterials) return false;

    const availableCards = [...player.hand, ...player.monsterZone.filter(m => m !== null)] as GameCard[];
    const tempAvailable = [...availableCards];
    let hasAll = true;
    let fieldMaterialsUsed = 0;

    for (const matName of fm.fusionMaterials) {
      const idx = tempAvailable.findIndex(c => isMaterialMatch(c, matName));
      if (idx === -1) {
        hasAll = false;
        break;
      }

      if (player.monsterZone.some(m => m?.instanceId === tempAvailable[idx].instanceId)) {
        fieldMaterialsUsed++;
      }
      tempAvailable.splice(idx, 1);
    }

    const hasEmptyZone = player.monsterZone.some(z => z === null);
    return hasAll && (hasEmptyZone || fieldMaterialsUsed > 0);
  });
};

const hasEmptyMonsterZone = (player: PlayerState) => player.monsterZone.some(z => z === null);
const hasEmptySpellTrapZone = (player: PlayerState) => player.spellTrapZone.some(z => z === null);

export const canActivateSpell = (
  card: Pick<GameCard, 'id' | 'instanceId'>,
  context: ActivationContext,
  fromZone?: number,
): boolean => {
  switch (card.id) {
    case 'dark-hole':
      return context.player.monsterZone.some(Boolean) || context.opponent.monsterZone.some(Boolean);
    case 'raigeki':
      return context.opponent.monsterZone.some(Boolean);
    case 'fissure':
      return context.opponent.monsterZone.some(monster => monster !== null && monster.position !== 'set-monster');
    case 'hinotama':
      return true;
    case 'pot-of-greed':
      return context.player.deck.length >= 2;
    case 'harpie-s-feather-duster':
      return context.opponent.spellTrapZone.some(Boolean);
    case 'tribute-to-the-doomed': {
      const discardableCards = context.player.hand.length - (fromZone === undefined ? 1 : 0);
      const hasMonsterTarget = context.player.monsterZone.some(Boolean) || context.opponent.monsterZone.some(Boolean);
      return discardableCards >= 1 && hasMonsterTarget;
    }
    case 'monster-reborn': {
      const anyMonsterInGraveyard =
        context.player.graveyard.some(cardInGy => cardInGy.type === 'Monster') ||
        context.opponent.graveyard.some(cardInGy => cardInGy.type === 'Monster');
      return hasEmptyMonsterZone(context.player) && anyMonsterInGraveyard;
    }
    case 'brain-control': {
      const hasTarget = context.opponent.monsterZone.some(
        monster => monster !== null && monster.position !== 'set-monster' && !monster.isFusion,
      );
      return context.player.lp >= 800 && hasEmptyMonsterZone(context.player) && hasTarget;
    }
    case 'de-spell':
      return context.opponent.spellTrapZone.some(zoneCard => zoneCard?.type === 'Spell');
    case 'polymerization':
      return getPossibleFusionMonsters(context.player).length > 0;
    default:
      return false;
  }
};

export const canManuallyActivateTrap = (
  card: Pick<GameCard, 'id'>,
  context: ActivationContext,
): boolean => {
  switch (card.id) {
    case 'dust-tornado':
      return context.opponent.spellTrapZone.some(Boolean);
    default:
      return false;
  }
};

export const getHandCardActionAvailability = (
  card: GameCard,
  context: ActivationContext,
): {
  summon: boolean;
  setMonster: boolean;
  activate: boolean;
  setSpellTrap: boolean;
} => {
  if (card.type === 'Monster') {
    if (card.isFusion) {
      return {
        summon: false,
        setMonster: false,
        activate: false,
        setSpellTrap: false,
      };
    }

    const level = card.level || 4;
    const tributesNeeded = level >= 7 ? 2 : level >= 5 ? 1 : 0;
    const availableTributes = context.player.monsterZone.filter(Boolean).length;
    const canNormalSummonOrSet =
      !context.normalSummonUsed &&
      availableTributes >= tributesNeeded &&
      (hasEmptyMonsterZone(context.player) || tributesNeeded > 0);

    return {
      summon: canNormalSummonOrSet,
      setMonster: canNormalSummonOrSet,
      activate: false,
      setSpellTrap: false,
    };
  }

  if (card.type === 'Spell') {
    return {
      summon: false,
      setMonster: false,
      activate: canActivateSpell(card, context),
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
