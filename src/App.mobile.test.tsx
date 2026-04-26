import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { AppPreferencesProvider } from './preferences/AppPreferencesProvider';

vi.mock('./lib/supabase', () => ({
  getSupabaseClient: () => null,
  isSupabaseConfigured: () => false,
}));

vi.mock('./pages/DeckBuilder', () => ({
  default: () => (
    <div>
      <div>Card Library</div>
    </div>
  ),
}));

vi.mock('./pages/HowToPlay', () => ({
  default: () => <div>The Basics</div>,
}));

vi.mock('./pages/GameHistoryPage', () => ({
  default: () => <div>Game History</div>,
}));

describe('App mobile shell', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(max-width: 767px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('opens into the play home and navigates between mobile tabs', async () => {
    render(
      <AppPreferencesProvider>
        <App />
      </AppPreferencesProvider>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: /cpu mode/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /cpu mode/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /competition/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /game history/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^rules$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^deck builder$/i }));
    expect(await screen.findByText(/card library/i)).toBeInTheDocument();
  });
});
