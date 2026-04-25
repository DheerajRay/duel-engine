export const APP_LANGUAGES = ['en', 'es', 'hi', 'ja'] as const;
export const APP_THEMES = ['obsidian', 'ivory-ledger', 'terminal-signal', 'pharaoh-gold'] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];
export type AppTheme = (typeof APP_THEMES)[number];

export interface AppPreferences {
  language: AppLanguage;
  theme: AppTheme;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  language: 'en',
  theme: 'obsidian',
};

export const isAppLanguage = (value: unknown): value is AppLanguage =>
  typeof value === 'string' && APP_LANGUAGES.includes(value as AppLanguage);

export const isAppTheme = (value: unknown): value is AppTheme =>
  typeof value === 'string' && APP_THEMES.includes(value as AppTheme);
