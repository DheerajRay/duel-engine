import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../constants';
import { makeCard, makePlayerState } from '../test/gameTestUtils';
import {
  getCardEffectEntry,
  getCardSupportMeta,
  getCompetitionAiScore,
  getHandCardActionAvailability,
} from './registry';

describe('effect registry', () => {
  it('creates a registry entry for every parsed card', () => {
    for (const card of Object.values(CARD_DB)) {
      expect(getCardEffectEntry(card.id).id).toBe(card.id);
    }
  });

  it('marks unsupported spell cards explicitly and hides illegal activation', () => {
    const swords = makeCard('swords-of-revealing-light');
    const entry = getCardEffectEntry(swords.id);
    const availability = getHandCardActionAvailability(swords, {
      player: makePlayerState({ hand: [swords] }),
      opponent: makePlayerState(),
      normalSummonUsed: false,
      phase: 'M1',
    });

    expect(entry.supportStatus).toBe('unsupported');
    expect(getCardSupportMeta(swords).label).toBe('Support Unsupported');
    expect(availability.activate).toBe(false);
    expect(availability.setSpellTrap).toBe(true);
  });

  it('enforces printed summon restrictions on special summon only monsters', () => {
    const redEyesBlackMetal = makeCard('red-eyes-black-metal-dragon');
    const availability = getHandCardActionAvailability(redEyesBlackMetal, {
      player: makePlayerState({ hand: [redEyesBlackMetal] }),
      opponent: makePlayerState(),
      normalSummonUsed: false,
      phase: 'M1',
    });

    expect(getCardEffectEntry(redEyesBlackMetal.id).supportStatus).toBe('partial');
    expect(availability.summon).toBe(false);
    expect(availability.setMonster).toBe(false);
  });

  it('weights signature cards more heavily for competition AI scoring', () => {
    const blueEyes = makeCard('blue-eyes-white-dragon');
    const battleOx = makeCard('battle-ox');

    const signatureScore = getCompetitionAiScore(
      blueEyes,
      { aggression: 1.4, signatureWeight: 1.3, removalBias: 1.1, backrowBias: 0.2, comebackBias: 0.6 },
      ['blue-eyes-white-dragon'],
      { opponentHasMonsters: true },
    );
    const normalScore = getCompetitionAiScore(
      battleOx,
      { aggression: 1.4, signatureWeight: 1.3, removalBias: 1.1, backrowBias: 0.2, comebackBias: 0.6 },
      ['blue-eyes-white-dragon'],
      { opponentHasMonsters: true },
    );

    expect(signatureScore).toBeGreaterThan(normalScore);
  });
});
