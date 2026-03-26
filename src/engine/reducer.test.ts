import { describe, expect, it } from 'vitest';
import { gameReducer } from './reducer';
import { makeCard, makeGameState, makePlayerState } from '../test/gameTestUtils';

describe('gameReducer', () => {
  it('deals opening hands when a game starts', () => {
    const state = makeGameState();
    const mainDeck = Array.from({ length: 40 }, () => 'battle-ox');
    const extraDeck = Array.from({ length: 3 }, () => 'flame-swordsman');

    const nextState = gameReducer(state, {
      type: 'START_GAME',
      playerDeck: mainDeck,
      opponentDeck: mainDeck,
      playerExtraDeck: extraDeck,
      opponentExtraDeck: extraDeck,
    });

    expect(nextState.player.hand).toHaveLength(5);
    expect(nextState.opponent.hand).toHaveLength(5);
    expect(nextState.player.deck).toHaveLength(35);
    expect(nextState.opponent.deck).toHaveLength(35);
    expect(nextState.player.extraDeck).toHaveLength(3);
    expect(nextState.opponent.extraDeck).toHaveLength(3);
  });

  it('reveals the drawn card for the player but not the opponent', () => {
    const playerState = makePlayerState({
      deck: [makeCard('battle-ox')],
    });
    const opponentState = makePlayerState({
      deck: [makeCard('battle-ox')],
    });

    const playerDrawState = gameReducer(
      makeGameState({ player: playerState, opponent: opponentState }),
      { type: 'DRAW_CARD', player: 'player' },
    );
    const opponentDrawState = gameReducer(
      makeGameState({ player: playerState, opponent: opponentState }),
      { type: 'DRAW_CARD', player: 'opponent' },
    );

    expect(playerDrawState.log.at(-1)?.message).toContain('Battle Ox');
    expect(opponentDrawState.log.at(-1)?.message).toBe('Opponent drew 1 card.');
  });

  it('keeps opponent face-down cards hidden in the logs', () => {
    const opponentSetMonster = makeCard('battle-ox');
    const opponentSetTrap = makeCard('mirror-force');

    const setMonsterState = gameReducer(
      makeGameState({
        opponent: makePlayerState({
          hand: [opponentSetMonster],
        }),
      }),
      {
        type: 'SUMMON_MONSTER',
        player: 'opponent',
        cardInstanceId: opponentSetMonster.instanceId,
        position: 'set-monster',
        tributes: [],
      },
    );

    const setTrapState = gameReducer(
      makeGameState({
        opponent: makePlayerState({
          hand: [opponentSetTrap],
        }),
      }),
      {
        type: 'SET_SPELL_TRAP',
        player: 'opponent',
        cardInstanceId: opponentSetTrap.instanceId,
      },
    );

    expect(setMonsterState.log.at(-1)?.message).toBe('Opponent set a monster face-down in Defense Position.');
    expect(setTrapState.log.at(-1)?.message).toBe('Opponent set a Spell/Trap card face-down.');
  });

  it('applies direct attack damage and logs the exact amount', () => {
    const attacker = makeCard('battle-ox', { position: 'attack', atk: 1700 });
    const state = makeGameState({
      turn: 'player',
      phase: 'BP',
      player: makePlayerState({
        monsterZone: [attacker, null, null, null, null],
      }),
      opponent: makePlayerState({
        lp: 8000,
      }),
    });

    const nextState = gameReducer(state, {
      type: 'DECLARE_ATTACK',
      attackerIndex: 0,
      targetIndex: null,
    });

    expect(nextState.opponent.lp).toBe(6300);
    expect(nextState.log.at(-1)?.message).toBe('You attacked directly with Battle Ox for 1700 damage.');
  });

  it('resolves Hinotama damage and records the source in the log', () => {
    const hinotama = makeCard('hinotama');
    const state = makeGameState({
      player: makePlayerState({
        hand: [hinotama],
      }),
      opponent: makePlayerState({
        lp: 8000,
      }),
    });

    const nextState = gameReducer(state, {
      type: 'ACTIVATE_SPELL',
      player: 'player',
      cardInstanceId: hinotama.instanceId,
    });

    expect(nextState.opponent.lp).toBe(7500);
    expect(nextState.player.graveyard.map(card => card.id)).toContain('hinotama');
    expect(nextState.log.at(-1)?.message).toBe('Opponent lost 500 LP from Hinotama.');
  });

  it('lets Dust Tornado destroy the targeted spell or trap and logs the destroyed card', () => {
    const dustTornado = makeCard('dust-tornado', { position: 'set-spell' });
    const mirrorForce = makeCard('mirror-force', { position: 'set-spell' });
    const state = makeGameState({
      player: makePlayerState({
        spellTrapZone: [dustTornado, null, null, null, null],
      }),
      opponent: makePlayerState({
        spellTrapZone: [mirrorForce, null, null, null, null],
      }),
    });

    const nextState = gameReducer(state, {
      type: 'ACTIVATE_TRAP',
      player: 'player',
      cardInstanceId: dustTornado.instanceId,
      fromZone: 0,
      targetIndex: 0,
      targetPlayer: 'opponent',
    });

    expect(nextState.opponent.spellTrapZone[0]).toBeNull();
    expect(nextState.opponent.graveyard.map(card => card.id)).toContain('mirror-force');
    expect(nextState.log.at(-1)?.message).toBe('Dust Tornado destroyed Mirror Force.');
  });

  it('lets Brain Control take a face-up opponent monster and returns it at end of turn', () => {
    const brainControl = makeCard('brain-control');
    const battleOx = makeCard('battle-ox', { position: 'attack' });
    const activatedState = gameReducer(
      makeGameState({
        player: makePlayerState({
          lp: 8000,
          hand: [brainControl],
        }),
        opponent: makePlayerState({
          monsterZone: [battleOx, null, null, null, null],
        }),
      }),
      {
        type: 'ACTIVATE_SPELL',
        player: 'player',
        cardInstanceId: brainControl.instanceId,
        targetIndex: 0,
        targetPlayer: 'opponent',
      },
    );

    const controlledMonster = activatedState.player.monsterZone.find(card => card?.id === 'battle-ox');
    expect(activatedState.player.lp).toBe(7200);
    expect(activatedState.opponent.monsterZone[0]).toBeNull();
    expect(controlledMonster?.temporaryControl).toBe(true);
    expect(controlledMonster?.originalOwner).toBe('opponent');
    expect(activatedState.log.at(-1)?.message).toBe('You paid 800 LP and took control of Battle Ox until the End Phase.');

    const returnedState = gameReducer(
      makeGameState({
        ...activatedState,
        turn: 'player',
        phase: 'EP',
      }),
      { type: 'NEXT_PHASE' },
    );

    expect(returnedState.player.monsterZone.some(card => card?.id === 'battle-ox')).toBe(false);
    expect(returnedState.opponent.monsterZone.some(card => card?.id === 'battle-ox')).toBe(true);
    expect(returnedState.opponent.monsterZone.find(card => card?.id === 'battle-ox')?.temporaryControl).toBe(false);
  });

  it('lets De-Spell destroy a Spell but only reveal a Trap', () => {
    const deSpell = makeCard('de-spell');
    const darkHole = makeCard('dark-hole', { position: 'set-spell' });
    const mirrorForce = makeCard('mirror-force', { position: 'set-spell' });

    const destroyState = gameReducer(
      makeGameState({
        player: makePlayerState({
          hand: [deSpell],
        }),
        opponent: makePlayerState({
          spellTrapZone: [darkHole, null, null, null, null],
        }),
      }),
      {
        type: 'ACTIVATE_SPELL',
        player: 'player',
        cardInstanceId: deSpell.instanceId,
        targetIndex: 0,
        targetPlayer: 'opponent',
      },
    );

    const revealState = gameReducer(
      makeGameState({
        player: makePlayerState({
          hand: [deSpell],
        }),
        opponent: makePlayerState({
          spellTrapZone: [mirrorForce, null, null, null, null],
        }),
      }),
      {
        type: 'ACTIVATE_SPELL',
        player: 'player',
        cardInstanceId: deSpell.instanceId,
        targetIndex: 0,
        targetPlayer: 'opponent',
      },
    );

    expect(destroyState.opponent.spellTrapZone[0]).toBeNull();
    expect(destroyState.opponent.graveyard.map(card => card.id)).toContain('dark-hole');
    expect(destroyState.log.at(-1)?.message).toBe('De-Spell destroyed Dark Hole.');

    expect(revealState.opponent.spellTrapZone[0]?.id).toBe('mirror-force');
    expect(revealState.opponent.graveyard.map(card => card.id)).not.toContain('mirror-force');
    expect(revealState.log.at(-1)?.message).toBe('De-Spell revealed Mirror Force, but it was not a Spell so it was not destroyed.');
  });

  it('lets Negate Attack cancel the attack and end the Battle Phase', () => {
    const attacker = makeCard('battle-ox', { position: 'attack', atk: 1700 });
    const negateAttack = makeCard('negate-attack', { position: 'set-spell' });
    const state = makeGameState({
      turn: 'opponent',
      phase: 'BP',
      opponent: makePlayerState({
        monsterZone: [attacker, null, null, null, null],
      }),
      player: makePlayerState({
        lp: 8000,
        spellTrapZone: [negateAttack, null, null, null, null],
      }),
    });

    const nextState = gameReducer(state, {
      type: 'DECLARE_ATTACK',
      attackerIndex: 0,
      targetIndex: null,
    });

    expect(nextState.phase).toBe('M2');
    expect(nextState.player.lp).toBe(8000);
    expect(nextState.player.spellTrapZone[0]).toBeNull();
    expect(nextState.player.graveyard.map(card => card.id)).toContain('negate-attack');
    expect(nextState.log.at(-1)?.message).toBe('The attack was negated and the Battle Phase ended.');
  });

  it('respects response overrides so optional reactive traps can be skipped', () => {
    const attacker = makeCard('battle-ox', { position: 'attack', atk: 1700 });
    const mirrorForce = makeCard('mirror-force', { position: 'set-spell' });
    const state = makeGameState({
      turn: 'opponent',
      phase: 'BP',
      opponent: makePlayerState({
        monsterZone: [attacker, null, null, null, null],
      }),
      player: makePlayerState({
        lp: 8000,
        spellTrapZone: [mirrorForce, null, null, null, null],
      }),
    });

    const nextState = gameReducer(state, {
      type: 'DECLARE_ATTACK',
      attackerIndex: 0,
      targetIndex: null,
      responseOverrides: {
        [mirrorForce.instanceId]: false,
      },
    });

    expect(nextState.player.spellTrapZone[0]?.id).toBe('mirror-force');
    expect(nextState.opponent.monsterZone[0]?.id).toBe('battle-ox');
    expect(nextState.player.lp).toBe(6300);
    expect(nextState.log.at(-1)?.message).toBe('Opponent attacked directly with Battle Ox for 1700 damage.');
  });
});
