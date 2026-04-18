import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';
import type { CloudProfileRow, UserProfile } from '../types/cloud';

const AUTH_TIMEOUT_MS = 5000;

const withTimeout = <T,>(promise: PromiseLike<T>, timeoutMs = AUTH_TIMEOUT_MS): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }) as Promise<T>;
};

export const getCurrentUser = async (): Promise<User | null> => {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await withTimeout(client.auth.getSession());
    if (error) {
      return null;
    }

    return data.session?.user ?? null;
  } catch {
    return null;
  }
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

  try {
    await withTimeout(client.from('profiles').upsert(upsertPayload, { onConflict: 'id' }));

    const { data } = await withTimeout(
      client
        .from('profiles')
        .select('id, email, display_name')
        .eq('id', user.id)
        .single(),
    );

    return toUserProfile(user, data as CloudProfileRow | null);
  } catch {
    return toUserProfile(user, null);
  }
};

export const signInWithPassword = async (email: string, password: string) => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }
};

export const signUpWithPassword = async (email: string, password: string) => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const { error } = await client.auth.signUp({
    email,
    password,
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

  withTimeout(client.auth.getSession()).then(async ({ data }) => {
    if (!data.session?.user) {
      callback(null);
      return;
    }

    callback(await ensureProfile(data.session.user));
  }).catch(() => {
    callback(null);
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
