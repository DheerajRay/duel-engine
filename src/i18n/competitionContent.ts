import type { AppLanguage } from '../types/preferences';
import type { CharacterContent, CompetitionOpponentContent } from '../types/cloud';

type CharacterLocalizedContent = {
  name: string;
  introLine: string;
  forfeitLine: string;
  stageClearLine: string;
  defeatLine: string;
  voice: CharacterContent['voice'];
};

const ENGLISH_CONTENT: Record<string, CharacterLocalizedContent> = {
  char_joey: {
    name: 'Joey Wheeler',
    introLine: 'Joey grins. "This is my kind of duel!"',
    forfeitLine: 'Joey leans in. "C\'mon, you can\'t bail now. Leave and I\'m takin\' this one by forfeit."',
    stageClearLine: 'Joey laughs it off, but you clearly took the momentum away from him.',
    defeatLine: 'Joey rode the chaos and pushed you out of the ladder this round.',
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
  char_mai: {
    name: 'Mai Valentine',
    introLine: 'Mai smiles. "Try to keep up with me."',
    forfeitLine: 'Mai smiles faintly. "Leaving already? If you walk away now, this duel is mine."',
    stageClearLine: 'Mai gives a measured nod. You outplayed her cleanly.',
    defeatLine: 'Mai kept control of the duel and punished every opening you gave her.',
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
  char_pegasus: {
    name: 'Maximillion Pegasus',
    introLine: 'Pegasus smiles. "Welcome to my delightful little performance."',
    forfeitLine: 'Pegasus chuckles. "Ending the show so soon? If you exit now, I shall gladly accept the forfeit."',
    stageClearLine: 'Pegasus applauds the upset. You broke through his tricks and stole the stage.',
    defeatLine: 'Pegasus turned the duel into his showpiece and you never regained the tempo.',
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
  char_yugi: {
    name: 'Yugi Muto',
    introLine: 'Yugi steadies his hand. "I trust the heart of the cards."',
    forfeitLine: 'Yugi stays calm. "If you leave now, I\'ll take this duel by forfeit. Come back when you\'re ready."',
    stageClearLine: 'Yugi accepts the loss with respect. You beat one of the ladder\'s steadiest duelists.',
    defeatLine: 'Yugi trusted the heart of the cards and found the line you could not answer.',
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
  char_kaiba: {
    name: 'Seto Kaiba',
    introLine: 'Kaiba smirks. "Prepare to be outclassed."',
    forfeitLine: 'Kaiba scoffs. "Running away? Fine. Leave now and I\'ll take the win by forfeit."',
    stageClearLine: 'Kaiba is furious, which means you did what few duelists can: you crushed his ego.',
    defeatLine: 'Kaiba never let the pressure up and closed the ladder with brute force.',
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
};

const LANGUAGE_CONTENT: Partial<Record<AppLanguage, Partial<Record<string, Partial<CharacterLocalizedContent>>>>> = {};

export const getLocalizedCompetitionContent = (
  language: AppLanguage,
  characterId: string,
  fallback?: {
    name?: string;
    introLine?: string;
    forfeitLine?: string;
    stageClearLine?: string;
    defeatLine?: string;
    voice?: Partial<CharacterContent['voice']>;
  },
) => {
  const english = ENGLISH_CONTENT[characterId];
  const localized = LANGUAGE_CONTENT[language]?.[characterId];

  return {
    name: localized?.name || english?.name || fallback?.name || characterId,
    introLine: localized?.introLine || english?.introLine || fallback?.introLine || '',
    forfeitLine: localized?.forfeitLine || english?.forfeitLine || fallback?.forfeitLine || '',
    stageClearLine: localized?.stageClearLine || english?.stageClearLine || fallback?.stageClearLine || '',
    defeatLine: localized?.defeatLine || english?.defeatLine || fallback?.defeatLine || '',
    voice: {
      intro: localized?.voice?.intro || english?.voice?.intro || fallback?.voice?.intro || '',
      summon: localized?.voice?.summon || english?.voice?.summon || fallback?.voice?.summon || '',
      spell: localized?.voice?.spell || english?.voice?.spell || fallback?.voice?.spell || '',
      trap: localized?.voice?.trap || english?.voice?.trap || fallback?.voice?.trap || '',
      attack: localized?.voice?.attack || english?.voice?.attack || fallback?.voice?.attack || '',
      turn: localized?.voice?.turn || english?.voice?.turn || fallback?.voice?.turn || '',
      loss: localized?.voice?.loss || english?.voice?.loss || fallback?.voice?.loss || '',
      forfeit: localized?.voice?.forfeit || english?.voice?.forfeit || fallback?.voice?.forfeit || '',
    },
  };
};
