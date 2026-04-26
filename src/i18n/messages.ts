import type { AppLanguage, AppTheme } from '../types/preferences';
import { en, type BaseMessages } from './messages/en';
import { es } from './messages/es';
import { hi } from './messages/hi';
import { ja } from './messages/ja';

export type TranslationKey = keyof BaseMessages;
export type TranslationParams = Record<string, string | number>;

const LANGUAGE_MESSAGES: Record<AppLanguage, Partial<Record<TranslationKey, string>>> = {
  en,
  es,
  hi,
  ja,
};

export const formatMessage = (template: string, params?: TranslationParams) => {
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (message, [key, value]) => message.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template,
  );
};

export const translate = (language: AppLanguage, key: TranslationKey, params?: TranslationParams) =>
  formatMessage(LANGUAGE_MESSAGES[language][key] ?? en[key], params);

export const getLanguageLabel = (language: AppLanguage) => {
  switch (language) {
    case 'es':
      return translate(language, 'languageSpanish');
    case 'hi':
      return translate(language, 'languageHindi');
    case 'ja':
      return translate(language, 'languageJapanese');
    case 'en':
    default:
      return translate(language, 'languageEnglish');
  }
};

export const getThemeLabel = (theme: AppTheme, language: AppLanguage) => {
  switch (theme) {
    case 'ivory-ledger':
      return translate(language, 'themeIvoryLedger');
    case 'terminal-signal':
      return translate(language, 'themeTerminalSignal');
    case 'pharaoh-gold':
      return translate(language, 'themePharaohGold');
    case 'obsidian':
    default:
      return translate(language, 'themeObsidian');
  }
};
