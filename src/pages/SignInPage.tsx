import { useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle, LogOut } from 'lucide-react';
import { ensureProfile, getCurrentUser, signInWithPassword, signOut, signUpWithPassword } from '../services/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import type { UserProfile } from '../types/cloud';

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
          ? 'Account created, but no session was returned. Check your account confirmation settings if you expect immediate sign-in.'
          : 'Sign-in succeeded, but no session was returned.');
      }

      const nextProfile = await ensureProfile(user);
      setProfile(nextProfile);
      setStatus('success');
      onSuccess?.();
    } catch (authError) {
      setStatus('error');
      setError(authError instanceof Error ? authError.message : 'Authentication failed.');
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
    ? 'w-full max-w-lg border border-zinc-800 bg-zinc-950 p-6 md:p-8'
    : 'w-full max-w-lg border border-zinc-800 bg-zinc-950 p-6 md:p-8';

  const content = (
    <div className={frameClasses}>
      <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500 mb-3">Account</div>
      <h2 className="text-2xl font-mono uppercase tracking-[0.18em] text-white mb-3">
        {profile ? 'Account Connected' : 'Sign In'}
      </h2>
      <p className="text-sm text-zinc-400 leading-6 mb-6">
        Use email and password to keep your decks, competition progress, and duel history tied to this account.
      </p>

      {!accountSyncReady && (
        <div className="mb-4 border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-400">
          Account sign-in is not available in this environment. You can continue as a guest.
        </div>
      )}

      {profile ? (
        <div className="space-y-5">
          <div className="border border-zinc-800 bg-black px-4 py-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">Signed In As</div>
            <div className="mt-2 text-base text-white">{profile.email ?? profile.displayName}</div>
          </div>
          {onUseCurrentAccount ? (
            <div className="grid gap-3">
              <button
                onClick={onUseCurrentAccount}
                className="w-full border border-zinc-600 hover:bg-white hover:text-black text-white px-4 py-3 font-mono text-sm uppercase tracking-widest transition-colors"
              >
                Use This Account
              </button>
              <button
                onClick={() => void handleSignOut()}
                className="w-full border border-zinc-800 hover:border-zinc-600 hover:text-white text-zinc-500 px-4 py-3 font-mono text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                Sign In Different Account
              </button>
            </div>
          ) : (
            <button
              onClick={() => void handleSignOut()}
              className="w-full border border-zinc-600 hover:bg-white hover:text-black text-white px-4 py-3 font-mono text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              <LogOut size={16} />
              Sign Out
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
              className={`border px-4 py-3 font-mono text-xs uppercase tracking-widest transition-colors ${authMode === 'sign-in' ? 'border-white bg-white text-black' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setAuthMode('create-account');
                resetFeedback();
              }}
              className={`border px-4 py-3 font-mono text-xs uppercase tracking-widest transition-colors ${authMode === 'create-account' ? 'border-white bg-white text-black' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white'}`}
            >
              Create Account
            </button>
          </div>

          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mt-2 w-full bg-black border border-zinc-800 rounded-none px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              className="mt-2 w-full bg-black border border-zinc-800 rounded-none px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </label>

          {error && <div className="text-sm text-red-400">{error}</div>}
          {status === 'success' && (
            <div className="text-sm text-zinc-300">
              {authMode === 'create-account' ? 'Account created and signed in.' : 'Signed in successfully.'}
            </div>
          )}

          <button
            onClick={() => void handleAuth()}
            disabled={!accountSyncReady || !email || !password || status === 'submitting'}
            className="w-full border border-zinc-600 hover:bg-white hover:text-black text-white disabled:border-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed px-4 py-3 font-mono text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            {status === 'submitting' ? <LoaderCircle size={16} className="animate-spin" /> : null}
            {authMode === 'create-account' ? 'Create Account' : 'Sign In'}
          </button>

          {mode === 'modal' && onContinueAsGuest && (
            <button
              onClick={onContinueAsGuest}
              className="w-full text-xs font-mono uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
            >
              Continue As Guest
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
    <div className="h-dvh md:h-screen box-border overflow-hidden bg-black text-white font-sans flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:p-0">
      <div className="h-14 md:h-12 border-b border-zinc-800 flex items-center justify-between px-3 md:px-6 bg-black shrink-0">
        <button
          onClick={onBack}
          className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 font-mono text-xs uppercase tracking-widest"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h1 className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Sign In</h1>
      </div>

      <div className="flex-1 overflow-y-auto flex items-center justify-center px-6 py-10">
        {content}
      </div>
    </div>
  );
}
