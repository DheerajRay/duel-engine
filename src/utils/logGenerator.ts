import { LogEntry } from '../types';

export type LogActionType =
  | 'DUEL_START'
  | 'DRAW_CARD'
  | 'NEXT_TURN'
  | 'SUMMON_MONSTER'
  | 'SET_MONSTER'
  | 'CHANGE_POSITION'
  | 'SET_SPELL_TRAP'
  | 'ACTIVATE_SPELL'
  | 'ACTIVATE_TRAP'
  | 'DECLARE_ATTACK'
  | 'DIRECT_ATTACK'
  | 'MONSTER_DESTROYED'
  | 'BATTLE_DAMAGE'
  | 'DECK_OUT'
  | 'VICTORY'
  | 'DEFEAT'
  | 'FACE_DOWN_REVEALED'
  | 'NO_MONSTERS_DESTROYED'
  | 'SPELL_EFFECT'
  | 'SYSTEM_MESSAGE';

const actorName = (player: 'player' | 'opponent') => player === 'player' ? 'You' : 'Opponent';
const possessiveName = (player: 'player' | 'opponent') => player === 'player' ? 'Your' : "Opponent's";

export const generateLog = (type: LogActionType, data: any = {}): LogEntry => {
  const { player, cardName, targetName, damage, nextTurn, effectType, targetCardName } = data;
  const actor = player === 'player' || player === 'opponent' ? actorName(player) : null;
  const possessive = player === 'player' || player === 'opponent' ? possessiveName(player) : null;

  let message = '';

  switch (type) {
    case 'DUEL_START':
      message = 'Duel start. Opponent goes first.';
      break;

    case 'DRAW_CARD':
      message = `${actor} drew 1 card${cardName ? `: ${cardName}.` : '.'}`;
      break;

    case 'NEXT_TURN':
      message = nextTurn === 'player' ? 'Your turn begins.' : "Opponent's turn begins.";
      break;

    case 'SUMMON_MONSTER':
      message = `${actor} summoned ${cardName}.`;
      break;

    case 'SET_MONSTER':
      message = cardName
        ? `${actor} set ${cardName} face-down in Defense Position.`
        : `${actor} set a monster face-down in Defense Position.`;
      break;

    case 'CHANGE_POSITION':
      message = `${actor} changed ${cardName}'s battle position.`;
      break;

    case 'SET_SPELL_TRAP':
      message = cardName
        ? `${actor} set ${cardName} face-down.`
        : `${actor} set a Spell/Trap card face-down.`;
      break;

    case 'ACTIVATE_SPELL': {
      const normalized = (cardName || '').toLowerCase();

      if (normalized === 'dark hole') {
        message = `${actor} activated Dark Hole. It destroys all monsters on the field.`;
      } else if (normalized === 'raigeki') {
        message = `${actor} activated Raigeki. It destroys all monsters the opponent controls.`;
      } else if (normalized === 'fissure') {
        message = `${actor} activated Fissure. It destroys the opponent's lowest-ATK face-up monster.`;
      } else if (normalized === 'hinotama') {
        message = `${actor} activated Hinotama. It deals 500 damage.`;
      } else if (normalized === 'pot of greed') {
        message = `${actor} activated Pot of Greed. It lets the player draw 2 cards.`;
      } else if (normalized === 'harpie\'s feather duster') {
        message = `${actor} activated Harpie's Feather Duster. It destroys all Spells and Traps the opponent controls.`;
      } else if (normalized === 'tribute to the doomed') {
        message = `${actor} activated Tribute to the Doomed. It discards 1 card to destroy 1 monster.`;
      } else if (normalized === 'monster reborn') {
        message = `${actor} activated Monster Reborn. It Special Summons a monster from a Graveyard.`;
      } else if (normalized === 'brain control') {
        message = `${actor} activated Brain Control. It pays 800 LP to take control of an opponent's face-up monster until the End Phase.`;
      } else if (normalized === 'de-spell') {
        message = `${actor} activated De-Spell. It destroys a targeted Spell card, or reveals a Set Trap.`;
      } else if (normalized === 'polymerization') {
        message = `${actor} activated Polymerization. It Fusion Summons using materials from the hand or field.`;
      } else {
        message = `${actor} activated ${cardName}.`;
      }
      break;
    }

    case 'ACTIVATE_TRAP': {
      const normalized = (cardName || '').toLowerCase();

      if (normalized === 'trap hole') {
        message = `${actor} activated Trap Hole. It destroys a newly summoned monster with 1000 or more ATK.`;
      } else if (normalized === 'mirror force') {
        message = `${actor} activated Mirror Force. It destroys all Attack Position monsters the attacker controls.`;
      } else if (normalized === 'magic cylinder') {
        message = `${actor} activated Magic Cylinder. It negates the attack and inflicts damage equal to the attacking monster's ATK.`;
      } else if (normalized === 'negate attack') {
        message = `${actor} activated Negate Attack. It negates the attack and ends the Battle Phase.`;
      } else if (normalized === 'dust tornado') {
        message = `${actor} activated Dust Tornado. It destroys 1 Spell/Trap card.`;
      } else {
        message = `${actor} activated ${cardName}.`;
      }
      break;
    }

    case 'DECLARE_ATTACK':
      message = `${actor} declared an attack with ${cardName} on ${targetName}.`;
      break;

    case 'DIRECT_ATTACK':
      message = `${actor} attacked directly with ${cardName}${typeof damage === 'number' ? ` for ${damage} damage` : ''}.`;
      break;

    case 'MONSTER_DESTROYED':
      if (player === 'both') {
        message = 'Both monsters were destroyed in battle.';
      } else {
        message = `${possessive} ${cardName} was destroyed and sent to the Graveyard.`;
      }
      break;

    case 'BATTLE_DAMAGE':
      if (cardName) {
        message = `${actor} lost ${damage} LP${cardName ? ` from ${cardName}` : ''}.`;
      } else {
        message = `${actor} lost ${damage} LP.`;
      }
      break;

    case 'DECK_OUT':
      message = player === 'player'
        ? 'You could not draw a card and lost by deck out.'
        : 'Opponent could not draw a card and lost by deck out.';
      break;

    case 'VICTORY':
      message = 'You won the duel.';
      break;

    case 'DEFEAT':
      message = 'You lost the duel.';
      break;

    case 'FACE_DOWN_REVEALED':
      message = `Face-down monster revealed: ${cardName}.`;
      break;

    case 'NO_MONSTERS_DESTROYED':
      message = 'No monsters were destroyed in that battle.';
      break;

    case 'SPELL_EFFECT':
      if (effectType === 'dark-hole') {
        message = 'Dark Hole resolved and destroyed all monsters on the field.';
      } else if (effectType === 'raigeki') {
        message = 'Raigeki resolved and destroyed all monsters on the defending side of the field.';
      } else if (effectType === 'fissure-fail') {
        message = 'Fissure resolved, but there was no valid face-up monster to destroy.';
      } else if (effectType === 'pot-of-greed') {
        message = `${actor} drew 2 cards from Pot of Greed.`;
      } else if (effectType === 'harpies-feather-duster') {
        message = "Harpie's Feather Duster resolved and destroyed all Spell/Trap cards on the defending side of the field.";
      } else if (effectType === 'brain-control') {
        message = `${actor} paid 800 LP and took control of ${targetCardName || 'the targeted monster'} until the End Phase.`;
      } else if (effectType === 'dust-tornado') {
        message = `Dust Tornado destroyed ${targetCardName || 'the targeted Spell/Trap card'}.`;
      } else if (effectType === 'de-spell') {
        message = `De-Spell destroyed ${targetCardName || 'the targeted Spell card'}.`;
      } else if (effectType === 'de-spell-reveal') {
        message = `De-Spell revealed ${targetCardName || 'the targeted Set card'}, but it was not a Spell so it was not destroyed.`;
      } else {
        message = 'The card effect resolved.';
      }
      break;

    case 'SYSTEM_MESSAGE':
      message = data.message || 'System message.';
      break;

    default:
      message = 'The duel continues.';
  }

  return {
    id: Math.random().toString(36).substring(2, 9),
    type,
    message,
    data,
  };
};
