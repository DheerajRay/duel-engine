import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./lib/supabase', () => ({
  getSupabaseClient: () => null,
  isSupabaseConfigured: () => false,
}));

describe('App', () => {
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  const continueAsGuest = async () => {
    await waitFor(() => expect(screen.getByRole('button', { name: /continue as guest/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }));
  };

  it('starts a cpu random duel from the battlefield picker and shows the centered mode heading', async () => {
    const { container } = render(<App />);

    await continueAsGuest();
    await waitFor(() => expect(screen.getByRole('button', { name: /cpu mode/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /cpu mode/i }));

    expect(screen.getByText(/select deck type/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /random deck/i })[0]);

    await screen.findByText('P1 Turn');
    expect(screen.getByText(/CPU Mode: Random Deck/i)).toBeInTheDocument();

    const playerDeck = screen.getAllByTitle('Main Deck').at(-1) as HTMLElement;
    fireEvent.click(playerDeck);

    const overlay = container.querySelector('div.absolute.inset-0.z-40') as HTMLElement;

    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain('absolute');
    expect(overlay.className).not.toContain('fixed');
    expect(within(overlay).getByText('Duel Event')).toBeInTheDocument();
    expect(within(overlay).getByText(/Duel start\. Opponent goes first\./i)).toBeInTheDocument();

  }, 15000);

  it('starts a cpu custom duel for a new user by seeding the starter deck as the saved custom deck', async () => {
    render(<App />);

    await continueAsGuest();
    await waitFor(() => expect(screen.getByRole('button', { name: /cpu mode/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /cpu mode/i }));

    fireEvent.click(screen.getAllByRole('button', { name: /custom deck/i })[0]);

    await screen.findByText('P1 Turn');
    expect(screen.getByText(/CPU Mode: Custom Deck/i)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('ygo_custom_deck') || '[]').length).toBeGreaterThanOrEqual(40);
    expect(window.localStorage.getItem('ygo_primary_deck_id')).toBeTruthy();
  }, 15000);

  it('opens the competition lobby and starts stage one for a new user with the starter deck', async () => {
    render(<App />);

    await continueAsGuest();
    await waitFor(() => expect(screen.getByRole('button', { name: /competition mode/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /competition mode/i }));

    expect(screen.getByText(/Ladder Progress/i)).toBeInTheDocument();
    expect(screen.getByText(/Current Stage: 1 \/ 5/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /begin ladder/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /begin ladder/i }));

    expect(await screen.findByRole('heading', { name: /joey wheeler/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /begin duel/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /begin duel/i }));

    await screen.findByText('P1 Turn');
    expect(screen.getByText(/Stage 1 of 5: Joey Wheeler/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Joey Wheeler LP/i).length).toBeGreaterThan(0);
    expect(JSON.parse(window.localStorage.getItem('ygo_custom_deck') || '[]').length).toBeGreaterThanOrEqual(40);
  }, 15000);

  it('resumes competition from saved stage progress and confirms forfeits with character-specific copy', async () => {
    window.localStorage.setItem('ygo_competition_stage_index', '2');

    render(<App />);

    await continueAsGuest();
    await waitFor(() => expect(screen.getByRole('button', { name: /competition mode/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /competition mode/i }));

    expect(screen.getByRole('button', { name: /resume ladder/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /resume ladder/i }));

    fireEvent.click(await screen.findByRole('button', { name: /begin duel/i }));

    await screen.findByText(/Stage 3 of 5: Maximillion Pegasus/i);
    expect(window.localStorage.getItem('ygo_competition_stage_index')).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: /menu/i }));

    expect(screen.getByText(/Forfeit Duel\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Ending the show so soon\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Your ladder progress will stay at Maximillion Pegasus\./i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /forfeit duel/i }));

    await screen.findByRole('button', { name: /competition mode/i });
    expect(window.localStorage.getItem('ygo_competition_stage_index')).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: /competition mode/i }));

    fireEvent.click(screen.getByRole('button', { name: /resume ladder/i }));

    fireEvent.click(await screen.findByRole('button', { name: /begin duel/i }));

    await screen.findByText(/Stage 3 of 5: Maximillion Pegasus/i);
  }, 15000);

  it('shows the auth prompt on app open for guests', async () => {
    render(<App />);

    expect(await screen.findByText(/cloud sync/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^sign in$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter password/i)).toBeInTheDocument();
  });
});
