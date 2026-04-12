import { useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle, LogOut } from 'lucide-react';
import { ensureProfile, getCurrentUser, signInWithMagicLink, signOut } from '../services/auth';
import type { UserProfile } from '../types/cloud';

export default function SignInPage({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

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

  const handleSignIn = async () => {
    setStatus('sending');
    setError(null);

    try {
      await signInWithMagicLink(email);
      setStatus('sent');
    } catch (signInError) {
      setStatus('error');
      setError(signInError instanceof Error ? signInError.message : 'Sign-in failed.');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setProfile(null);
    setStatus('idle');
  };

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
        <div className="w-full max-w-lg border border-zinc-800 bg-zinc-950 p-6 md:p-8">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500 mb-3">Cloud Sync</div>
          <h2 className="text-2xl font-mono uppercase tracking-[0.18em] text-white mb-3">
            {profile ? 'Account Connected' : 'Sign In'}
          </h2>
          <p className="text-sm text-zinc-400 leading-6 mb-6">
            Sign in with a magic link to sync decks, competition progress, and duel history across devices. Guest play stays local.
          </p>

          {profile ? (
            <div className="space-y-5">
              <div className="border border-zinc-800 bg-black px-4 py-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-zinc-500">Signed In As</div>
                <div className="mt-2 text-base text-white">{profile.email ?? profile.displayName}</div>
              </div>
              <button
                onClick={() => void handleSignOut()}
                className="w-full border border-zinc-600 hover:bg-white hover:text-black text-white px-4 py-3 font-mono text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="space-y-4">
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

              {error && <div className="text-sm text-red-400">{error}</div>}
              {status === 'sent' && (
                <div className="text-sm text-zinc-300">
                  Magic link sent. Open the link in your email, then return here.
                </div>
              )}

              <button
                onClick={() => void handleSignIn()}
                disabled={!email || status === 'sending'}
                className="w-full border border-zinc-600 hover:bg-white hover:text-black text-white disabled:border-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed px-4 py-3 font-mono text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                {status === 'sending' ? <LoaderCircle size={16} className="animate-spin" /> : null}
                Send Magic Link
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
