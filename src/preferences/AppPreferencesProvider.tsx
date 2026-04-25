import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { APP_LANGUAGES, APP_THEMES, type AppLanguage, type AppPreferences, type AppTheme } from '../types/preferences';
import { applyPreferencesToDocument, normalizePreferences, readCachedPreferences, updateProfilePreferences, writeCachedPreferences } from '../services/preferences';
import { getLanguageLabel, getThemeLabel, translate, type TranslationKey, type TranslationParams } from '../i18n/messages';
import type { UserProfile } from '../types/cloud';

interface AppPreferencesContextValue {
  preferences: AppPreferences;
  language: AppLanguage;
  theme: AppTheme;
  setLanguage: (language: AppLanguage) => void;
  setTheme: (theme: AppTheme) => void;
  hydrateProfile: (profile: UserProfile | null) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  languageOptions: { value: AppLanguage; label: string }[];
  themeOptions: { value: AppTheme; label: string }[];
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AppPreferences>(() => normalizePreferences(readCachedPreferences()));
  const [profileId, setProfileId] = useState<string | null>(null);

  const applyAndPersist = useCallback((nextPreferences: AppPreferences, nextProfileId?: string | null) => {
    setPreferences(nextPreferences);
    writeCachedPreferences(nextPreferences);
    applyPreferencesToDocument(nextPreferences);

    const resolvedProfileId = nextProfileId ?? profileId;
    if (resolvedProfileId) {
      setProfileId(resolvedProfileId);
      void updateProfilePreferences(resolvedProfileId, nextPreferences);
    } else {
      setProfileId(null);
    }
  }, [profileId]);

  const hydrateProfile = useCallback((profile: UserProfile | null) => {
    if (!profile) {
      setProfileId(null);
      return;
    }

    const nextPreferences = normalizePreferences({
      language: profile.language,
      theme: profile.theme,
    });

    setProfileId(profile.id);
    setPreferences(nextPreferences);
    writeCachedPreferences(nextPreferences);
    applyPreferencesToDocument(nextPreferences);
  }, []);

  const setLanguage = useCallback((language: AppLanguage) => {
    applyAndPersist({ ...preferences, language });
  }, [applyAndPersist, preferences]);

  const setTheme = useCallback((theme: AppTheme) => {
    applyAndPersist({ ...preferences, theme });
  }, [applyAndPersist, preferences]);

  const value = useMemo<AppPreferencesContextValue>(() => {
    const t = (key: TranslationKey, params?: TranslationParams) => translate(preferences.language, key, params);

    return {
      preferences,
      language: preferences.language,
      theme: preferences.theme,
      setLanguage,
      setTheme,
      hydrateProfile,
      t,
      languageOptions: APP_LANGUAGES.map((value) => ({
        value,
        label: getLanguageLabel(value),
      })),
      themeOptions: APP_THEMES.map((value) => ({
        value,
        label: getThemeLabel(value, preferences.language),
      })),
    };
  }, [hydrateProfile, preferences, setLanguage, setTheme]);

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export const useAppPreferences = () => {
  const context = useContext(AppPreferencesContext);
  if (!context) {
    throw new Error('useAppPreferences must be used within AppPreferencesProvider.');
  }

  return context;
};
