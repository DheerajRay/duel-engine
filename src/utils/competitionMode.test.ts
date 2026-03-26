import { describe, expect, it } from 'vitest';
import { COMPETITION_LADDER, formatCompetitionLogMessage } from './competitionMode';

describe('competitionMode', () => {
  it('defines a five-opponent ladder in the expected order', () => {
    expect(COMPETITION_LADDER.map(opponent => opponent.name)).toEqual([
      'Joey Wheeler',
      'Mai Valentine',
      'Maximillion Pegasus',
      'Yugi Muto',
      'Seto Kaiba',
    ]);
  });

  it('adds character flavor only to the competition opponent logs', () => {
    const joey = COMPETITION_LADDER[0];

    const opponentLog = formatCompetitionLogMessage(
      {
        id: '1',
        type: 'SUMMON_MONSTER',
        message: 'Opponent summoned Battle Ox.',
        data: { player: 'opponent', cardName: 'Battle Ox' },
      },
      joey,
    );

    const playerLog = formatCompetitionLogMessage(
      {
        id: '2',
        type: 'SUMMON_MONSTER',
        message: 'You summoned Battle Ox.',
        data: { player: 'player', cardName: 'Battle Ox' },
      },
      joey,
    );

    expect(opponentLog).toContain('Joey pumps a fist.');
    expect(opponentLog).toContain('Opponent summoned Battle Ox.');
    expect(playerLog).toBe('You summoned Battle Ox.');
  });
});
