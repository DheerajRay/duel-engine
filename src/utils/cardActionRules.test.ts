import { describe, expect, it } from 'vitest';
import { makeCard, makePlayerState } from '../test/gameTestUtils';
import { canActivateSpell, canManuallyActivateTrap, getHandCardActionAvailability } from './cardActionRules';

describe('cardActionRules', () => {
  it('does not allow Polymerization to activate without a valid fusion line', () => {
    const polymerization = makeCard('polymerization');
    const context = {
      player: makePlayerState({
        hand: [polymerization, makeCard('battle-ox')],
        extraDeck: [makeCard('flame-swordsman')],
      }),
      opponent: makePlayerState(),
      normalSummonUsed: false,
    };

    expect(canActivateSpell(polymerization, context)).toBe(false);
    expect(getHandCardActionAvailability(polymerization, context).activate).toBe(false);
    expect(getHandCardActionAvailability(polymerization, context).setSpellTrap).toBe(true);
  });

  it('allows Polymerization when a valid fusion monster and materials are available', () => {
    const polymerization = makeCard('polymerization');
    const context = {
      player: makePlayerState({
        hand: [polymerization, makeCard('time-wizard'), makeCard('baby-dragon')],
        extraDeck: [makeCard('thousand-dragon')],
      }),
      opponent: makePlayerState(),
      normalSummonUsed: false,
    };

    expect(canActivateSpell(polymerization, context)).toBe(true);
  });

  it('does not allow De-Spell unless the opponent controls a Spell card', () => {
    const deSpell = makeCard('de-spell');

    const noSpellContext = {
      player: makePlayerState({
        hand: [deSpell],
      }),
      opponent: makePlayerState({
        spellTrapZone: [makeCard('mirror-force', { position: 'set-spell' }), null, null, null, null],
      }),
      normalSummonUsed: false,
    };

    const spellContext = {
      player: makePlayerState({
        hand: [deSpell],
      }),
      opponent: makePlayerState({
        spellTrapZone: [makeCard('dark-hole', { position: 'set-spell' }), null, null, null, null],
      }),
      normalSummonUsed: false,
    };

    expect(canActivateSpell(deSpell, noSpellContext)).toBe(false);
    expect(canActivateSpell(deSpell, spellContext)).toBe(true);
  });

  it('does not offer Activate for unsupported spell cards', () => {
    const swords = makeCard('swords-of-revealing-light');
    const context = {
      player: makePlayerState({
        hand: [swords],
      }),
      opponent: makePlayerState(),
      normalSummonUsed: false,
    };

    const availability = getHandCardActionAvailability(swords, context);

    expect(availability.activate).toBe(false);
    expect(availability.setSpellTrap).toBe(true);
  });

  it('requires tribute resources before offering high-level monster summon or set', () => {
    const summonedSkull = makeCard('summoned-skull');

    const noTributeContext = {
      player: makePlayerState({
        hand: [summonedSkull],
      }),
      opponent: makePlayerState(),
      normalSummonUsed: false,
    };

    const withTributeContext = {
      player: makePlayerState({
        hand: [summonedSkull],
        monsterZone: [makeCard('battle-ox'), null, null, null, null],
      }),
      opponent: makePlayerState(),
      normalSummonUsed: false,
    };

    expect(getHandCardActionAvailability(summonedSkull, noTributeContext).summon).toBe(false);
    expect(getHandCardActionAvailability(summonedSkull, noTributeContext).setMonster).toBe(false);
    expect(getHandCardActionAvailability(summonedSkull, withTributeContext).summon).toBe(true);
    expect(getHandCardActionAvailability(summonedSkull, withTributeContext).setMonster).toBe(true);
  });

  it('only allows manual trap activation for supported traps with live targets', () => {
    const dustTornado = makeCard('dust-tornado', { position: 'set-spell' });
    const mirrorForce = makeCard('mirror-force', { position: 'set-spell' });

    const noTargetContext = {
      player: makePlayerState({
        spellTrapZone: [dustTornado, null, null, null, null],
      }),
      opponent: makePlayerState(),
      normalSummonUsed: false,
    };

    const liveTargetContext = {
      player: makePlayerState({
        spellTrapZone: [dustTornado, null, null, null, null],
      }),
      opponent: makePlayerState({
        spellTrapZone: [makeCard('dark-hole', { position: 'set-spell' }), null, null, null, null],
      }),
      normalSummonUsed: false,
    };

    expect(canManuallyActivateTrap(dustTornado, noTargetContext)).toBe(false);
    expect(canManuallyActivateTrap(dustTornado, liveTargetContext)).toBe(true);
    expect(canManuallyActivateTrap(mirrorForce, liveTargetContext)).toBe(false);
  });
});
