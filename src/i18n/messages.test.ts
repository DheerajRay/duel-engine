import { describe, expect, it } from 'vitest';
import { translate } from './messages';

describe('messages', () => {
  it('falls back to English when a locale key is missing', () => {
    expect(translate('es', 'assistantEmptyState')).toBe(translate('en', 'assistantEmptyState'));
  });

  it('returns localized language labels with valid unicode content', () => {
    expect(translate('ja', 'languageJapanese')).toBe('日本語');
    expect(translate('hi', 'languageHindi')).toBe('हिन्दी');
    expect(translate('es', 'languageSpanish')).toBe('Español');
  });
});
