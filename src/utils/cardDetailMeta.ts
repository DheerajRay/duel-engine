import type { Card } from '../types';

export const getCardTypeLabel = (card: Card) => {
  if (card.type === 'Monster') {
    const parts = ['Monster'];
    if (card.monsterRace) parts.push(card.monsterRace);
    if (card.monsterAbilities?.length) parts.push(...card.monsterAbilities);
    else if (card.monsterTypeLine) parts.push(card.monsterTypeLine);
    return parts.join(' / ');
  }

  return [card.type, card.spellTrapProperty || card.subType || 'Normal'].join(' / ');
};

export const getMonsterSummonLabel = (card: Card) => {
  if (card.type !== 'Monster') return null;
  if (card.isFusion) return 'Fusion';
  if (!card.level || card.level <= 4) return 'No Tribute';
  if (card.level <= 6) return '1 Tribute';
  return '2 Tributes';
};

export const getPrimaryCardFacts = (card: Card) => {
  const facts: { label: string; value: string }[] = [];

  if (card.attribute) facts.push({ label: 'Attribute', value: card.attribute });
  if (card.passcode) facts.push({ label: 'Passcode', value: card.passcode });
  if (card.originalPage) facts.push({ label: 'Page', value: String(card.originalPage) });
  if (card.cardStatus) facts.push({ label: 'Status', value: card.cardStatus });
  if (card.matchedSnapshot !== undefined) {
    facts.push({ label: 'Snapshot', value: card.matchedSnapshot ? 'Matched' : 'Unverified' });
  }

  return facts;
};

export const getSecondaryCardSections = (card: Card) => {
  const sections: { title: string; value: string }[] = [];

  if (card.summoningCondition) sections.push({ title: 'Summon Condition', value: card.summoningCondition });
  if (card.pendulumEffect) sections.push({ title: 'Pendulum Effect', value: card.pendulumEffect });
  if (card.fusionMaterials?.length) sections.push({ title: 'Fusion Materials', value: card.fusionMaterials.join(' + ') });
  if (card.supports?.length) sections.push({ title: 'Supports', value: card.supports.join(', ') });
  if (card.antiSupports?.length) sections.push({ title: 'Anti-Supports', value: card.antiSupports.join(', ') });
  if (card.cardActions?.length) sections.push({ title: 'Card Actions', value: card.cardActions.join(', ') });
  if (card.effectTypes?.length) sections.push({ title: 'Effect Types', value: card.effectTypes.join(', ') });

  return sections;
};
