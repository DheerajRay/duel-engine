import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const mockGetCurrentUser = vi.fn();
const mockEnsureProfile = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock('./services/auth', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  ensureProfile: (...args: unknown[]) => mockEnsureProfile(...args),
  onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
  signOut: vi.fn(),
  toUserProfile: (user: { id: string; email?: string | null }, profile?: { displayName?: string | null } | null) => ({
    id: user.id,
    email: user.email ?? null,
    displayName: profile?.displayName ?? user.email?.split('@')[0] ?? 'Duelist',
  }),
}));

vi.mock('./services/gameContent', () => ({
  initializeGameContent: vi.fn().mockResolvedValue({ source: 'local', bundle: null }),
}));

vi.mock('./services/history', () => ({
  appendDuelHistoryEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./services/userData', () => ({
  clearCompetitionProgress: vi.fn().mockResolvedValue(undefined),
  ensureStarterCustomDeck: vi.fn().mockResolvedValue(null),
  getCompetitionProgress: vi.fn().mockResolvedValue({
    currentStageIndex: 0,
    lastClearedStage: -1,
    updatedAt: '2026-04-18T00:00:00.000Z',
  }),
  getPrimaryDeckSnapshot: vi.fn().mockResolvedValue(null),
  setCompetitionProgress: vi.fn().mockResolvedValue({
    currentStageIndex: 0,
    lastClearedStage: -1,
    updatedAt: '2026-04-18T00:00:00.000Z',
  }),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error?: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

describe('App auth bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('keeps the loading gate up until the stored account resolves and skips the guest dialog flash', async () => {
    const currentUser = createDeferred<{ id: string; email: string } | null>();

    mockGetCurrentUser.mockReturnValue(currentUser.promise);
    mockEnsureProfile.mockResolvedValue({
      id: 'user-1',
      email: 'duelist@example.com',
      displayName: 'duelist',
    });
    mockOnAuthStateChange.mockImplementation((callback: (profile: unknown) => void) => {
      callback(null);
      return () => undefined;
    });

    render(<App />);

    expect(screen.getByText(/loading account/i)).toBeInTheDocument();
    expect(screen.queryByText(/^account$/i)).not.toBeInTheDocument();

    currentUser.resolve({
      id: 'user-1',
      email: 'duelist@example.com',
    });

    await waitFor(() => {
      expect(screen.queryByText(/loading account/i)).not.toBeInTheDocument();
    });

    expect(screen.queryByText(/^account$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/signed in as duelist/i)).toBeInTheDocument();
  });
});
