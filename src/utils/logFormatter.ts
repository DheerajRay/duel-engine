import type { LogEntry } from '../types';
import type { AppLanguage } from '../types/preferences';
import { translate } from '../i18n/messages';

const actorName = (player: 'player' | 'opponent', language: AppLanguage) =>
  player === 'player'
    ? translate(language, 'actorYou')
    : translate(language, 'actorOpponent');

const possessiveName = (player: 'player' | 'opponent', language: AppLanguage) =>
  player === 'player'
    ? translate(language, 'actorYour')
    : translate(language, 'actorOpponentPossessive');

const withCardSuffix = (cardName?: string) => (cardName ? `: ${cardName}` : '');
const withDamageSuffix = (damage?: number) => (typeof damage === 'number' ? ` for ${damage} damage` : '');
const withRemainingSuffix = (remainingLp?: number, player?: 'player' | 'opponent', language: AppLanguage = 'en') =>
  typeof remainingLp === 'number' && player
    ? translate(language, 'remainingLpSuffix', {
        actor: actorName(player === 'player' ? 'opponent' : 'player', language),
        remainingLp,
      })
    : '';

export const formatLogEntryMessage = (entry: LogEntry, language: AppLanguage): string => {
  const { type, data = {} } = entry;
  const {
    player,
    cardName,
    targetName,
    damage,
    nextTurn,
    effectType,
    targetCardName,
    summonKind,
    tributeCount,
    isLethal,
    remainingLp,
  } = data as Record<string, any>;

  const actor = player === 'player' || player === 'opponent' ? actorName(player, language) : null;
  const possessive = player === 'player' || player === 'opponent' ? possessiveName(player, language) : null;
  const normalized = (cardName || '').toLowerCase();

  switch (type) {
    case 'DUEL_START':
      return translate(language, 'duelStartLog');
    case 'DRAW_CARD':
      return translate(language, 'drawCardLog', { actor, cardSuffix: withCardSuffix(cardName) });
    case 'NEXT_TURN':
      return nextTurn === 'player' ? translate(language, 'nextTurnPlayerLog') : translate(language, 'nextTurnOpponentLog');
    case 'SUMMON_MONSTER':
      if (summonKind === 'fusion') return translate(language, 'summonFusionLog', { actor, cardName });
      if (tributeCount >= 2) return translate(language, 'summonTributeTwoLog', { actor, cardName });
      if (tributeCount === 1) return translate(language, 'summonTributeOneLog', { actor, cardName });
      return translate(language, 'summonNormalLog', { actor, cardName });
    case 'SET_MONSTER':
      return cardName
        ? translate(language, 'setMonsterKnownLog', { actor, cardName })
        : translate(language, 'setMonsterUnknownLog', { actor });
    case 'CHANGE_POSITION':
      return translate(language, 'changePositionLog', { actor, cardName });
    case 'SET_SPELL_TRAP':
      return cardName
        ? translate(language, 'setSpellTrapKnownLog', { actor, cardName })
        : translate(language, 'setSpellTrapUnknownLog', { actor });
    case 'ACTIVATE_SPELL':
      switch (normalized) {
        case 'dark hole': return translate(language, 'spellActivateDarkHoleLog', { actor });
        case 'raigeki': return translate(language, 'spellActivateRaigekiLog', { actor });
        case 'fissure': return translate(language, 'spellActivateFissureLog', { actor });
        case 'hinotama': return translate(language, 'spellActivateHinotamaLog', { actor });
        case 'pot of greed': return translate(language, 'spellActivatePotOfGreedLog', { actor });
        case 'harpie\'s feather duster': return translate(language, 'spellActivateHarpiesLog', { actor });
        case 'tribute to the doomed': return translate(language, 'spellActivateTributeToDoomedLog', { actor });
        case 'monster reborn': return translate(language, 'spellActivateMonsterRebornLog', { actor });
        case 'brain control': return translate(language, 'spellActivateBrainControlLog', { actor });
        case 'de-spell': return translate(language, 'spellActivateDeSpellLog', { actor });
        case 'polymerization': return translate(language, 'spellActivatePolymerizationLog', { actor });
        default: return translate(language, 'spellActivateGenericLog', { actor, cardName });
      }
    case 'ACTIVATE_TRAP':
      switch (normalized) {
        case 'trap hole': return translate(language, 'trapActivateTrapHoleLog', { actor });
        case 'mirror force': return translate(language, 'trapActivateMirrorForceLog', { actor });
        case 'magic cylinder': return translate(language, 'trapActivateMagicCylinderLog', { actor });
        case 'negate attack': return translate(language, 'trapActivateNegateAttackLog', { actor });
        case 'dust tornado': return translate(language, 'trapActivateDustTornadoLog', { actor });
        default: return translate(language, 'trapActivateGenericLog', { actor, cardName });
      }
    case 'DECLARE_ATTACK':
      return translate(language, 'declareAttackLog', { actor, cardName, targetName });
    case 'DIRECT_ATTACK':
      if (isLethal) return translate(language, 'directAttackLethalLog', { actor, cardName });
      return translate(language, 'directAttackLog', {
        actor,
        cardName,
        damageSuffix: withDamageSuffix(damage),
        remainingSuffix: withRemainingSuffix(remainingLp, player, language),
      });
    case 'MONSTER_DESTROYED':
      return player === 'both'
        ? translate(language, 'monstersDestroyedBothLog')
        : translate(language, 'monsterDestroyedLog', { possessive, cardName });
    case 'BATTLE_DAMAGE':
      if (isLethal) return translate(language, 'battleDamageLethalLog', { actor, damage });
      return translate(language, 'battleDamageLog', {
        actor,
        damage,
        cardSuffix: cardName ? ` from ${cardName}` : '',
        remainingSuffix:
          typeof remainingLp === 'number'
            ? translate(language, 'droppedToLpSuffix', { remainingLp })
            : '',
      });
    case 'DECK_OUT':
      return player === 'player'
        ? translate(language, 'deckOutPlayerLog')
        : translate(language, 'deckOutOpponentLog');
    case 'VICTORY':
      return translate(language, 'victoryLog');
    case 'DEFEAT':
      return translate(language, 'defeatLog');
    case 'FACE_DOWN_REVEALED':
      return translate(language, 'faceDownReveal', { cardName });
    case 'NO_MONSTERS_DESTROYED':
      return translate(language, 'noMonstersDestroyed');
    case 'SPELL_EFFECT':
      switch (effectType) {
        case 'dark-hole': return translate(language, 'spellEffectDarkHoleLog');
        case 'raigeki': return translate(language, 'spellEffectRaigekiLog');
        case 'fissure-fail': return translate(language, 'spellEffectFissureFailLog');
        case 'pot-of-greed': return translate(language, 'spellEffectPotOfGreedLog', { actor });
        case 'harpies-feather-duster': return translate(language, 'spellEffectHarpiesLog');
        case 'brain-control':
          return translate(language, 'spellEffectBrainControlLog', {
            actor,
            targetName: targetCardName || translate(language, 'logTargetedMonsterDefault'),
          });
        case 'dust-tornado':
          return translate(language, 'spellEffectDustTornadoLog', {
            targetName: targetCardName || translate(language, 'logTargetedSpellTrapDefault'),
          });
        case 'de-spell':
          return translate(language, 'spellEffectDeSpellLog', {
            targetName: targetCardName || translate(language, 'logTargetedSpellCardDefault'),
          });
        case 'de-spell-reveal':
          return translate(language, 'spellEffectDeSpellRevealLog', {
            targetName: targetCardName || translate(language, 'logTargetedSetCardDefault'),
          });
        default: return translate(language, 'spellEffectGenericLog');
      }
    case 'SYSTEM_MESSAGE':
      return data.message || translate(language, 'systemMessageDefault');
    default:
      return entry.message || translate(language, 'duelContinues');
  }
};
