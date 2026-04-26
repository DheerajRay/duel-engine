import { useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle, LogOut } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { ensureProfile, getCurrentUser, signInWithPassword, signOut, signUpWithPassword } from '../services/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import type { UserProfile } from '../types/cloud';
import { useAppPreferences } from '../preferences/AppPreferencesProvider';

type AuthMode = 'sign-in' | 'create-account';

interface SignInPageProps {
  onBack: () => void;
  onSuccess?: () => void;
  onContinueAsGuest?: () => void;
  onUseCurrentAccount?: () => void;
  mode?: 'page' | 'modal';
}

export default function SignInPage({
  onBack,
  onSuccess,
  onContinueAsGuest,
  onUseCurrentAccount,
  mode = 'page',
}: SignInPageProps) {
  const { t, language, theme, setLanguage, setTheme, languageOptions, themeOptions } = useAppPreferences();
  const isMobile = useIsMobile();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const accountSyncReady = isSupabaseConfigured();

  useEffect(() => {
    const loadProfile = async () => {
      const user = await getCurrentUser();
      if (!user) {
        setProfile(null);
        return;
      }

      setProfile(await ensureProfile(user));
    };

    void loadProfile();
  }, []);

  const resetFeedback = () => {
    setStatus('idle');
    setError(null);
  };

  const handleAuth = async () => {
    setStatus('submitting');
    setError(null);

    try {
      if (authMode === 'sign-in') {
        await signInWithPassword(email, password);
      } else {
        await signUpWithPassword(email, password);
      }

      const user = await getCurrentUser();
      if (!user) {
        throw new Error(authMode === 'create-account'
          ? t('authCreateSessionMissing')
          : t('authSignInSessionMissing'));
      }

      const nextProfile = await ensureProfile(user);
      setProfile(nextProfile);
      setStatus('success');
      onSuccess?.();
    } catch (authError) {
      setStatus('error');
      setError(authError instanceof Error ? authError.message : t('authFailed'));
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setProfile(null);
    setPassword('');
    setStatus('idle');
    setError(null);
  };

  const frameClasses = mode === 'modal'
    ? 'theme-panel w-full max-w-lg p-6 md:p-8'
    : `w-full ${isMobile ? 'theme-screen max-w-none rounded-none border-x-0 border-y p-5' : 'theme-panel max-w-lg p-6 md:p-8'}`;

  const content = (
    <div className={frameClasses}>
      <div className="theme-eyebrow mb-3 text-[10px]">{t('account')}</div>
      <h2 className="theme-title mb-3 text-2xl uppercase">
        {profile ? t('accountConnected') : t('signIn')}
      </h2>
      <p className="theme-muted mb-6 text-sm leading-6">
        {t('accountIntro')}
      </p>

      {!accountSyncReady && (
        <div className="theme-elevated theme-muted mb-4 px-4 py-3 text-sm">
          {t('accountUnavailable')}
        </div>
      )}

      {profile ? (
        <div className="space-y-5">
          <div className="theme-elevated px-4 py-4">
            <div className="theme-eyebrow text-[10px]">{t('signedInAs')}</div>
            <div className="mt-2 text-base text-white">{profile.email ?? profile.displayName}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="theme-eyebrow text-[10px]">{t('language')}</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as typeof language)}
                className="theme-input mt-2 w-full rounded-none px-4 py-3 text-sm"
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="theme-eyebrow text-[10px]">{t('theme')}</span>
              <select
                value={theme}
                onChange={(event) => setTheme(event.target.value as typeof theme)}
                className="theme-input mt-2 w-full rounded-none px-4 py-3 text-sm"
              >
                {themeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {onUseCurrentAccount ? (
            <div className="grid gap-3">
              <button
                onClick={onUseCurrentAccount}
                className="theme-button w-full px-4 py-3 font-mono text-sm uppercase tracking-widest"
              >
                {t('useThisAccount')}
              </button>
              <button
                onClick={() => void handleSignOut()}
                className="theme-button-subtle w-full px-4 py-3 font-mono text-sm uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                {t('signInDifferentAccount')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => void handleSignOut()}
              className="theme-button w-full px-4 py-3 font-mono text-sm uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <LogOut size={16} />
              {t('signOut')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setAuthMode('sign-in');
                resetFeedback();
              }}
              className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${authMode === 'sign-in' ? 'theme-chip-active' : 'theme-chip'}`}
            >
              {t('signIn')}
            </button>
            <button
              onClick={() => {
                setAuthMode('create-account');
                resetFeedback();
              }}
              className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${authMode === 'create-account' ? 'theme-chip-active' : 'theme-chip'}`}
            >
              {t('createAccount')}
            </button>
          </div>

          <label className="block">
            <span className="theme-eyebrow text-[10px]">{t('email')}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('placeholderEmail')}
              className="theme-input mt-2 w-full rounded-none px-4 py-3 text-sm transition-colors"
            />
          </label>

          <label className="block">
            <span className="theme-eyebrow text-[10px]">{t('password')}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('enterPassword')}
              className="theme-input mt-2 w-full rounded-none px-4 py-3 text-sm transition-colors"
            />
          </label>

          {error && <div className="text-sm text-red-400">{error}</div>}
          {status === 'success' && (
            <div className="text-sm text-zinc-300">
              {authMode === 'create-account' ? t('accountConnected') : t('signInSuccess')}
            </div>
          )}

          <button
            onClick={() => void handleAuth()}
            disabled={!accountSyncReady || !email || !password || status === 'submitting'}
            className="theme-button w-full disabled:border-[var(--app-border)] disabled:text-[var(--app-text-dim)] disabled:cursor-not-allowed px-4 py-3 font-mono text-sm uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {status === 'submitting' ? <LoaderCircle size={16} className="animate-spin" /> : null}
            {authMode === 'create-account' ? t('createAccount') : t('signIn')}
          </button>

          {mode === 'modal' && onContinueAsGuest && (
            <button
              onClick={onContinueAsGuest}
              className="theme-subtle w-full text-xs font-mono uppercase tracking-widest transition-colors"
            >
              {t('continueAsGuest')}
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (mode === 'modal') {
    return content;
  }

  return (
    <div className="theme-screen h-dvh md:h-screen box-border overflow-hidden font-sans flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:p-0">
      <div className="theme-screen theme-divider h-14 md:h-12 border-b flex items-center justify-between px-3 md:px-6 shrink-0">
        <button
          onClick={onBack}
          className="theme-subtle hover:text-[var(--app-text-primary)] transition-colors flex items-center gap-2 font-mono text-xs uppercase tracking-widest"
        >
          <ArrowLeft size={14} /> {t('back')}
        </button>
        <h1 className="theme-eyebrow text-xs">{t('signIn')}</h1>
      </div>

      <div className={`flex-1 overflow-y-auto ${isMobile ? 'px-0 py-0' : 'flex items-center justify-center px-6 py-10'}`}>
        {content}
      </div>
    </div>
  );
}
