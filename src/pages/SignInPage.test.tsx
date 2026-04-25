import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SignInPage from './SignInPage';
import { AppPreferencesProvider } from '../preferences/AppPreferencesProvider';

const mockGetCurrentUser = vi.fn();
const mockEnsureProfile = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock('../services/auth', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  ensureProfile: (...args: unknown[]) => mockEnsureProfile(...args),
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
  signOut: () => mockSignOut(),
}));

describe('SignInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers existing users a choice between using the current account and signing into a different account', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'duelist@example.com',
    });
    mockEnsureProfile.mockResolvedValue({
      id: 'user-1',
      email: 'duelist@example.com',
      displayName: 'duelist',
    });
    mockSignOut.mockResolvedValue(undefined);

    const handleUseCurrentAccount = vi.fn();

    render(
      <AppPreferencesProvider>
        <SignInPage
          mode="modal"
          onBack={() => undefined}
          onUseCurrentAccount={handleUseCurrentAccount}
        />
      </AppPreferencesProvider>,
    );

    expect(await screen.findByText(/account connected/i)).toBeInTheDocument();
    expect(screen.getByText(/duelist@example.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use this account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in different account/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /use this account/i }));
    expect(handleUseCurrentAccount).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /sign in different account/i }));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(await screen.findByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter password/i)).toBeInTheDocument();
  });
});
