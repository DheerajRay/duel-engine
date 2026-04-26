import type { LogEntry } from '../types';
import type {
  CharacterContent,
  CompetitionOpponentContent,
  CompetitionStageContent,
} from '../types/cloud';
import type { AppLanguage } from '../types/preferences';
import { CHARACTER_DECKS } from './characterDecks';
import { getLocalizedCompetitionContent } from '../i18n/competitionContent';
import { translate } from '../i18n/messages';

const localCharacters: CharacterContent[] = [
  {
    id: 'char_joey',
    name: 'Joey Wheeler',
    introLine: 'Joey grins. "This is my kind of duel!"',
    forfeitLine: 'Joey leans in. "C\'mon, you can\'t bail now. Leave and I\'m takin\' this one by forfeit."',
    stageClearLine: 'Joey laughs it off, but you clearly took the momentum away from him.',
    defeatLine: 'Joey rode the chaos and pushed you out of the ladder this round.',
    signatureCardIds: ['time-wizard', 'jinzo', 'thousand-dragon'],
    aiProfile: { aggression: 1.25, signatureWeight: 1.1, removalBias: 0.75, backrowBias: 0.2, comebackBias: 0.8 },
    voice: {
      intro: 'Joey grins. "This is my kind of duel!"',
      summon: 'Joey pumps a fist. "Get in there and swing hard!"',
      spell: 'Joey slams a card down. "Time for one of my wild cards!"',
      trap: 'Joey smirks. "Bet ya did not see that comin\'!"',
      attack: 'Joey points forward. "Go on, finish the job!"',
      turn: 'Joey draws fast. "My move now!"',
      loss: 'Joey exhales. "Aw, man... you got me that time."',
      forfeit: 'Joey leans in. "C\'mon, you can\'t bail now. Leave and I\'m takin\' this one by forfeit."',
    },
  },
  {
    id: 'char_mai',
    name: 'Mai Valentine',
    introLine: 'Mai smiles. "Try to keep up with me."',
    forfeitLine: 'Mai smiles faintly. "Leaving already? If you walk away now, this duel is mine."',
    stageClearLine: 'Mai gives a measured nod. You outplayed her cleanly.',
    defeatLine: 'Mai kept control of the duel and punished every opening you gave her.',
    signatureCardIds: ['harpie-lady-sisters', 'harpie-s-feather-duster', 'mirror-wall'],
    aiProfile: { aggression: 0.7, signatureWeight: 0.8, removalBias: 0.8, backrowBias: 1.1, comebackBias: 0.5 },
    voice: {
      intro: 'Mai smiles. "Try to keep up with me."',
      summon: 'Mai flicks her card forward. "Grace beats brute force every time."',
      spell: 'Mai tilts her head. "A smart duelist always keeps a trick ready."',
      trap: 'Mai laughs softly. "Walked right into it."',
      attack: 'Mai gives a calm nod. "Now strike."',
      turn: 'Mai draws with confidence. "Watch closely."',
      loss: 'Mai folds her arms. "Not bad. You earned that win."',
      forfeit: 'Mai smiles faintly. "Leaving already? If you walk away now, this duel is mine."',
    },
  },
  {
    id: 'char_pegasus',
    name: 'Maximillion Pegasus',
    introLine: 'Pegasus smiles. "Welcome to my delightful little performance."',
    forfeitLine: 'Pegasus chuckles. "Ending the show so soon? If you exit now, I shall gladly accept the forfeit."',
    stageClearLine: 'Pegasus applauds the upset. You broke through his tricks and stole the stage.',
    defeatLine: 'Pegasus turned the duel into his showpiece and you never regained the tempo.',
    signatureCardIds: ['relinquished', 'toon-world', 'blue-eyes-toon-dragon'],
    aiProfile: { aggression: 0.4, signatureWeight: 1.2, removalBias: 0.9, backrowBias: 1.3, comebackBias: 0.9 },
    voice: {
      intro: 'Pegasus smiles. "Welcome to my delightful little performance."',
      summon: 'Pegasus raises a hand. "Let us add a touch of flair to the field."',
      spell: 'Pegasus chuckles. "A most entertaining twist, would you not agree?"',
      trap: 'Pegasus laughs. "Ohoho, exactly as planned."',
      attack: 'Pegasus gestures grandly. "Take the stage and attack."',
      turn: 'Pegasus draws elegantly. "Now then, let the show continue."',
      loss: 'Pegasus sighs. "What an unexpectedly marvelous upset."',
      forfeit: 'Pegasus chuckles. "Ending the show so soon? If you exit now, I shall gladly accept the forfeit."',
    },
  },
  {
    id: 'char_yugi',
    name: 'Yugi Muto',
    introLine: 'Yugi steadies his hand. "I trust the heart of the cards."',
    forfeitLine: 'Yugi stays calm. "If you leave now, I\'ll take this duel by forfeit. Come back when you\'re ready."',
    stageClearLine: 'Yugi accepts the loss with respect. You beat one of the ladder\'s steadiest duelists.',
    defeatLine: 'Yugi trusted the heart of the cards and found the line you could not answer.',
    signatureCardIds: ['dark-magician', 'dark-paladin', 'monster-reborn'],
    aiProfile: { aggression: 0.9, signatureWeight: 1.1, removalBias: 1, backrowBias: 0.6, comebackBias: 1.2 },
    voice: {
      intro: 'Yugi steadies his hand. "I trust the heart of the cards."',
      summon: 'Yugi focuses. "Stand with me and guide this duel."',
      spell: 'Yugi nods. "There is always a path forward."',
      trap: 'Yugi answers at once. "I was ready for that."',
      attack: 'Yugi calls out. "Now, attack with everything you have!"',
      turn: 'Yugi draws calmly. "My turn. I believe in this deck."',
      loss: 'Yugi lowers his gaze. "You dueled with real conviction."',
      forfeit: 'Yugi stays calm. "If you leave now, I\'ll take this duel by forfeit. Come back when you\'re ready."',
    },
  },
  {
    id: 'char_kaiba',
    name: 'Seto Kaiba',
    introLine: 'Kaiba smirks. "Prepare to be outclassed."',
    forfeitLine: 'Kaiba scoffs. "Running away? Fine. Leave now and I\'ll take the win by forfeit."',
    stageClearLine: 'Kaiba is furious, which means you did what few duelists can: you crushed his ego.',
    defeatLine: 'Kaiba never let the pressure up and closed the ladder with brute force.',
    signatureCardIds: ['blue-eyes-white-dragon', 'blue-eyes-ultimate-dragon', 'crush-card-virus'],
    aiProfile: { aggression: 1.4, signatureWeight: 1.3, removalBias: 1.1, backrowBias: 0.2, comebackBias: 0.6 },
    voice: {
      intro: 'Kaiba smirks. "Prepare to be outclassed."',
      summon: 'Kaiba snaps the card onto the field. "Witness real power."',
      spell: 'Kaiba scoffs. "This duel is already decided."',
      trap: 'Kaiba laughs coldly. "You walked straight into my setup."',
      attack: 'Kaiba points ahead. "Crush them."',
      turn: 'Kaiba draws sharply. "My turn. Try to keep up."',
      loss: 'Kaiba clenches his jaw. "Do not get used to it."',
      forfeit: 'Kaiba scoffs. "Running away? Fine. Leave now and I\'ll take the win by forfeit."',
    },
  },
];

const localStages: CompetitionStageContent[] = [
  { stageNumber: 1, characterId: 'char_joey', summaryOrder: 1 },
  { stageNumber: 2, characterId: 'char_mai', summaryOrder: 2 },
  { stageNumber: 3, characterId: 'char_pegasus', summaryOrder: 3 },
  { stageNumber: 4, characterId: 'char_yugi', summaryOrder: 4 },
  { stageNumber: 5, characterId: 'char_kaiba', summaryOrder: 5 },
];

export const COMPETITION_CHARACTERS: CharacterContent[] = localCharacters.map((character) => ({
  ...character,
  signatureCardIds: [...character.signatureCardIds],
  aiProfile: { ...character.aiProfile },
  voice: { ...character.voice },
}));

export const COMPETITION_STAGES: CompetitionStageContent[] = localStages.map((stage) => ({ ...stage }));

export const COMPETITION_LADDER: CompetitionOpponentContent[] = [];

const cloneCharacter = (character: CharacterContent): CharacterContent => ({
  ...character,
  signatureCardIds: [...character.signatureCardIds],
  aiProfile: { ...character.aiProfile },
  voice: { ...character.voice },
});

export const replaceCompetitionCharacters = (characters: CharacterContent[]) => {
  COMPETITION_CHARACTERS.splice(0, COMPETITION_CHARACTERS.length, ...characters.map(cloneCharacter));
  rebuildCompetitionLadder();
};

export const replaceCompetitionStages = (stages: CompetitionStageContent[]) => {
  COMPETITION_STAGES.splice(
    0,
    COMPETITION_STAGES.length,
    ...stages
      .map((stage) => ({ ...stage }))
      .sort((left, right) => left.stageNumber - right.stageNumber),
  );
  rebuildCompetitionLadder();
};

export const rebuildCompetitionLadder = () => {
  const ladder = COMPETITION_STAGES.map((stage) => {
    const deck = CHARACTER_DECKS.find((entry) => entry.id === stage.characterId);
    const character = COMPETITION_CHARACTERS.find((entry) => entry.id === stage.characterId);

    if (!deck || !character) {
      return null;
    }

    return {
      ...deck,
      stage: stage.stageNumber,
      totalStages: COMPETITION_STAGES.length,
      voice: character.voice,
      signatureCardIds: [...character.signatureCardIds],
      summaryLines: {
        stageClear: character.stageClearLine,
        defeat: character.defeatLine,
      },
      aiProfile: { ...character.aiProfile },
    } satisfies CompetitionOpponentContent;
  }).filter(Boolean) as CompetitionOpponentContent[];

  COMPETITION_LADDER.splice(0, COMPETITION_LADDER.length, ...ladder);
};

rebuildCompetitionLadder();

export const getCompetitionNotablePlay = (logs: LogEntry[], language: AppLanguage = 'en') => {
  const recentInterestingLog = [...logs].reverse().find((entry) =>
    ['ACTIVATE_SPELL', 'ACTIVATE_TRAP', 'SUMMON_MONSTER', 'DIRECT_ATTACK', 'MONSTER_DESTROYED'].includes(entry.type),
  );

  return recentInterestingLog?.message ?? translate(language, 'steadyPressureNotablePlay');
};

export const formatCompetitionLogMessage = (
  entry: LogEntry,
  opponent: CompetitionOpponentContent,
  language: AppLanguage = 'en',
): string => {
  const localizedContent = getLocalizedCompetitionContent(language, opponent.id, opponent);
  const isOpponentEvent = entry.data?.player === 'opponent' || entry.data?.nextTurn === 'opponent';

  if (entry.type === 'DUEL_START') {
    return `${localizedContent.voice.intro} ${entry.message}`;
  }

  if (entry.type === 'NEXT_TURN' && entry.data?.nextTurn === 'opponent') {
    return `${localizedContent.voice.turn} ${entry.message}`;
  }

  if (entry.type === 'DECK_OUT' && entry.data?.player === 'opponent') {
    return `${localizedContent.voice.loss} ${entry.message}`;
  }

  if (!isOpponentEvent) {
    return entry.message;
  }

  if (entry.type === 'SUMMON_MONSTER' || entry.type === 'SET_MONSTER') {
    return `${localizedContent.voice.summon} ${entry.message}`;
  }

  if (entry.type === 'ACTIVATE_SPELL' || entry.type === 'SPELL_EFFECT') {
    return `${localizedContent.voice.spell} ${entry.message}`;
  }

  if (entry.type === 'ACTIVATE_TRAP') {
    return `${localizedContent.voice.trap} ${entry.message}`;
  }

  if (entry.type === 'DECLARE_ATTACK' || entry.type === 'DIRECT_ATTACK' || entry.type === 'BATTLE_DAMAGE') {
    return `${localizedContent.voice.attack} ${entry.message}`;
  }

  return entry.message;
};
