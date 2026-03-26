import { describe, expect, it } from 'vitest';
import { generateLog } from './logGenerator';

describe('generateLog', () => {
  it('keeps face-down opponent monster logs hidden when no card name is provided', () => {
    const log = generateLog('SET_MONSTER', { player: 'opponent' });

    expect(log.message).toBe('Opponent set a monster face-down in Defense Position.');
  });

  it('describes spell effects explicitly', () => {
    const log = generateLog('ACTIVATE_SPELL', {
      player: 'player',
      cardName: 'Dark Hole',
    });

    expect(log.message).toContain('activated Dark Hole');
    expect(log.message).toContain('destroys all monsters on the field');
  });

  it('includes exact damage on direct attacks', () => {
    const log = generateLog('DIRECT_ATTACK', {
      player: 'player',
      cardName: 'Battle Ox',
      damage: 1700,
    });

    expect(log.message).toBe('You attacked directly with Battle Ox for 1700 damage.');
  });

  it('includes the damage source when LP is reduced', () => {
    const log = generateLog('BATTLE_DAMAGE', {
      player: 'opponent',
      damage: 500,
      cardName: 'Hinotama',
    });

    expect(log.message).toBe('Opponent lost 500 LP from Hinotama.');
  });

  it('describes Brain Control and De-Spell outcomes explicitly', () => {
    const brainControlLog = generateLog('SPELL_EFFECT', {
      player: 'player',
      effectType: 'brain-control',
      targetCardName: 'Battle Ox',
    });
    const deSpellRevealLog = generateLog('SPELL_EFFECT', {
      player: 'player',
      effectType: 'de-spell-reveal',
      targetCardName: 'Mirror Force',
    });

    expect(brainControlLog.message).toBe('You paid 800 LP and took control of Battle Ox until the End Phase.');
    expect(deSpellRevealLog.message).toBe('De-Spell revealed Mirror Force, but it was not a Spell so it was not destroyed.');
  });
});
