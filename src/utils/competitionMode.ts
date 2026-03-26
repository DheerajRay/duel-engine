import type { SavedDeck } from '../pages/DeckBuilder';
import type { LogEntry } from '../types';
import { CHARACTER_DECKS } from './characterDecks';

type CompetitionOpponentId = 'char_joey' | 'char_mai' | 'char_pegasus' | 'char_yugi' | 'char_kaiba';

type CompetitionVoiceProfile = {
  intro: string;
  summon: string;
  spell: string;
  trap: string;
  attack: string;
  turn: string;
  loss: string;
};

export type CompetitionOpponent = SavedDeck & {
  stage: number;
  totalStages: number;
  voice: CompetitionVoiceProfile;
};

const ladderOrder: CompetitionOpponentId[] = ['char_joey', 'char_mai', 'char_pegasus', 'char_yugi', 'char_kaiba'];

const voiceProfiles: Record<CompetitionOpponentId, CompetitionVoiceProfile> = {
  char_joey: {
    intro: 'Joey grins. "This is my kind of duel!"',
    summon: 'Joey pumps a fist. "Get in there and swing hard!"',
    spell: 'Joey slams a card down. "Time for one of my wild cards!"',
    trap: 'Joey smirks. "Bet ya did not see that comin\'!"',
    attack: 'Joey points forward. "Go on, finish the job!"',
    turn: 'Joey draws fast. "My move now!"',
    loss: 'Joey exhales. "Aw, man... you got me that time."',
  },
  char_mai: {
    intro: 'Mai smiles. "Try to keep up with me."',
    summon: 'Mai flicks her card forward. "Grace beats brute force every time."',
    spell: 'Mai tilts her head. "A smart duelist always keeps a trick ready."',
    trap: 'Mai laughs softly. "Walked right into it."',
    attack: 'Mai gives a calm nod. "Now strike."',
    turn: 'Mai draws with confidence. "Watch closely."',
    loss: 'Mai folds her arms. "Not bad. You earned that win."',
  },
  char_pegasus: {
    intro: 'Pegasus smiles. "Welcome to my delightful little performance."',
    summon: 'Pegasus raises a hand. "Let us add a touch of flair to the field."',
    spell: 'Pegasus chuckles. "A most entertaining twist, would you not agree?"',
    trap: 'Pegasus laughs. "Ohoho, exactly as planned."',
    attack: 'Pegasus gestures grandly. "Take the stage and attack."',
    turn: 'Pegasus draws elegantly. "Now then, let the show continue."',
    loss: 'Pegasus sighs. "What an unexpectedly marvelous upset."',
  },
  char_yugi: {
    intro: 'Yugi steadies his hand. "I trust the heart of the cards."',
    summon: 'Yugi focuses. "Stand with me and guide this duel."',
    spell: 'Yugi nods. "There is always a path forward."',
    trap: 'Yugi answers at once. "I was ready for that."',
    attack: 'Yugi calls out. "Now, attack with everything you have!"',
    turn: 'Yugi draws calmly. "My turn. I believe in this deck."',
    loss: 'Yugi lowers his gaze. "You dueled with real conviction."',
  },
  char_kaiba: {
    intro: 'Kaiba smirks. "Prepare to be outclassed."',
    summon: 'Kaiba snaps the card onto the field. "Witness real power."',
    spell: 'Kaiba scoffs. "This duel is already decided."',
    trap: 'Kaiba laughs coldly. "You walked straight into my setup."',
    attack: 'Kaiba points ahead. "Crush them."',
    turn: 'Kaiba draws sharply. "My turn. Try to keep up."',
    loss: 'Kaiba clenches his jaw. "Do not get used to it."',
  },
};

export const COMPETITION_LADDER: CompetitionOpponent[] = ladderOrder.map((id, index) => {
  const deck = CHARACTER_DECKS.find(characterDeck => characterDeck.id === id);

  if (!deck) {
    throw new Error(`Missing character deck for competition ladder: ${id}`);
  }

  return {
    ...deck,
    stage: index + 1,
    totalStages: ladderOrder.length,
    voice: voiceProfiles[id],
  };
});

export const formatCompetitionLogMessage = (entry: LogEntry, opponent: CompetitionOpponent): string => {
  const isOpponentEvent = entry.data?.player === 'opponent' || entry.data?.nextTurn === 'opponent';

  if (entry.type === 'DUEL_START') {
    return `${opponent.voice.intro} ${entry.message}`;
  }

  if (entry.type === 'NEXT_TURN' && entry.data?.nextTurn === 'opponent') {
    return `${opponent.voice.turn} ${entry.message}`;
  }

  if (entry.type === 'DECK_OUT' && entry.data?.player === 'opponent') {
    return `${opponent.voice.loss} ${entry.message}`;
  }

  if (!isOpponentEvent) {
    return entry.message;
  }

  if (entry.type === 'SUMMON_MONSTER' || entry.type === 'SET_MONSTER') {
    return `${opponent.voice.summon} ${entry.message}`;
  }

  if (entry.type === 'ACTIVATE_SPELL' || entry.type === 'SPELL_EFFECT') {
    return `${opponent.voice.spell} ${entry.message}`;
  }

  if (entry.type === 'ACTIVATE_TRAP') {
    return `${opponent.voice.trap} ${entry.message}`;
  }

  if (entry.type === 'DECLARE_ATTACK' || entry.type === 'DIRECT_ATTACK' || entry.type === 'BATTLE_DAMAGE') {
    return `${opponent.voice.attack} ${entry.message}`;
  }

  return entry.message;
};
