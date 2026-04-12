import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';
import type { CloudProfileRow, UserProfile } from '../types/cloud';

export const getCurrentUser = async (): Promise<User | null> => {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data } = await client.auth.getUser();
  return data.user ?? null;
};

export const toUserProfile = (user: User, profileRow?: CloudProfileRow | null): UserProfile => ({
  id: user.id,
  email: user.email ?? null,
  displayName: profileRow?.display_name || user.email?.split('@')[0] || 'Duelist',
});

export const ensureProfile = async (user: User): Promise<UserProfile> => {
  const client = getSupabaseClient();
  if (!client) {
    return toUserProfile(user, null);
  }

  const fallbackName = user.email?.split('@')[0] || 'Duelist';
  const upsertPayload = {
    id: user.id,
    email: user.email ?? null,
    display_name: fallbackName,
  };

  await client.from('profiles').upsert(upsertPayload, { onConflict: 'id' });

  const { data } = await client
    .from('profiles')
    .select('id, email, display_name')
    .eq('id', user.id)
    .single();

  return toUserProfile(user, data as CloudProfileRow | null);
};

export const signInWithMagicLink = async (email: string) => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    throw error;
  }
};

export const signOut = async () => {
  const client = getSupabaseClient();
  if (!client) return;

  const { error } = await client.auth.signOut();
  if (error) throw error;
};

export const onAuthStateChange = (callback: (profile: UserProfile | null) => void) => {
  const client = getSupabaseClient();
  if (!client) {
    callback(null);
    return () => undefined;
  }

  client.auth.getUser().then(async ({ data }) => {
    if (!data.user) {
      callback(null);
      return;
    }

    callback(await ensureProfile(data.user));
  });

  const { data } = client.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.user) {
      callback(null);
      return;
    }

    callback(await ensureProfile(session.user));
  });

  return () => {
    data.subscription.unsubscribe();
  };
};
