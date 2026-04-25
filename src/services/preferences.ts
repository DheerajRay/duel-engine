import { getSupabaseClient } from '../lib/supabase';
import type { AppLanguage, AppPreferences, AppTheme } from '../types/preferences';
import { DEFAULT_APP_PREFERENCES, isAppLanguage, isAppTheme } from '../types/preferences';

const APP_PREFERENCES_STORAGE_KEY = 'duel-engine.preferences';

const normalizeLanguage = (language: unknown): AppLanguage =>
  isAppLanguage(language) ? language : DEFAULT_APP_PREFERENCES.language;

const normalizeTheme = (theme: unknown): AppTheme =>
  isAppTheme(theme) ? theme : DEFAULT_APP_PREFERENCES.theme;

export const normalizePreferences = (value: Partial<AppPreferences> | null | undefined): AppPreferences => ({
  language: normalizeLanguage(value?.language),
  theme: normalizeTheme(value?.theme),
});

export const readCachedPreferences = (): AppPreferences => {
  if (typeof window === 'undefined') {
    return DEFAULT_APP_PREFERENCES;
  }

  try {
    const rawValue = window.localStorage.getItem(APP_PREFERENCES_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_APP_PREFERENCES;
    }

    return normalizePreferences(JSON.parse(rawValue) as Partial<AppPreferences>);
  } catch {
    return DEFAULT_APP_PREFERENCES;
  }
};

export const writeCachedPreferences = (preferences: AppPreferences) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(APP_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
};

export const applyPreferencesToDocument = (preferences: AppPreferences) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = preferences.theme;
  document.documentElement.lang = preferences.language;
};

export const updateProfilePreferences = async (
  profileId: string,
  preferences: Partial<AppPreferences>,
) => {
  const client = getSupabaseClient();
  if (!client) {
    return;
  }

  const payload: Partial<{ language: AppLanguage; theme: AppTheme }> = {};

  if (preferences.language) {
    payload.language = normalizeLanguage(preferences.language);
  }

  if (preferences.theme) {
    payload.theme = normalizeTheme(preferences.theme);
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  await client.from('profiles').update(payload).eq('id', profileId);
};
