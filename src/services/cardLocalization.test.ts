import { describe, expect, it } from 'vitest';
import { CARD_LOCALIZATIONS } from './gameContentStore';
import { getLocalizedCardText } from './cardLocalization';

describe('cardLocalization', () => {
  it('falls back to English card text when a locale row is missing', () => {
    CARD_LOCALIZATIONS.en['test-card'] = {
      name: 'Test Card',
      description: 'English description',
    };

    expect(
      getLocalizedCardText(
        { id: 'test-card', name: 'Fallback Name', description: 'Fallback Description' },
        'ja',
      ),
    ).toEqual({
      name: 'Test Card',
      description: 'English description',
    });
  });
});
