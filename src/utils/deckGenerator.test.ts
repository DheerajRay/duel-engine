import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../constants';
import { generateCuratedDeck, generateCuratedExtraDeck } from './deckGenerator';

const countCopies = (cards: string[]) =>
  cards.reduce<Record<string, number>>((counts, id) => {
    counts[id] = (counts[id] || 0) + 1;
    return counts;
  }, {});

describe('deckGenerator', () => {
  it('builds a 40-card main deck with only non-fusion cards and no more than 3 copies', () => {
    const deck = generateCuratedDeck();
    const counts = countCopies(deck);

    expect(deck).toHaveLength(40);
    expect(deck.every(id => CARD_DB[id] && !CARD_DB[id].isFusion)).toBe(true);
    expect(Object.values(counts).every(count => count <= 3)).toBe(true);
  });

  it('builds an extra deck of fusion monsters with no more than 3 copies each', () => {
    const extraDeck = generateCuratedExtraDeck();
    const counts = countCopies(extraDeck);

    expect(extraDeck.length).toBeLessThanOrEqual(15);
    expect(extraDeck.every(id => CARD_DB[id]?.isFusion)).toBe(true);
    expect(Object.values(counts).every(count => count <= 3)).toBe(true);
  });
});
