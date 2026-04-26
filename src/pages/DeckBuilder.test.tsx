import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeckBuilder from './DeckBuilder';
import { AppPreferencesProvider } from '../preferences/AppPreferencesProvider';

describe('DeckBuilder', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('toggles between library view and deck view in the main panel', () => {
    window.localStorage.setItem('ygo_custom_deck', JSON.stringify(Array.from({ length: 40 }, () => 'battle-ox')));
    window.localStorage.setItem('ygo_custom_extra_deck', JSON.stringify(['flame-swordsman']));

    render(
      <AppPreferencesProvider>
        <DeckBuilder onBack={() => {}} />
      </AppPreferencesProvider>,
    );

    expect(screen.getByPlaceholderText(/search cards/i)).toBeInTheDocument();
    expect(screen.queryByText(/current deck/i)).not.toBeInTheDocument();

    const toggleViewButton = () => {
      const countChip = screen.getByText(/\(\d+\/60\)/i);
      const button = countChip.closest('button');
      if (!button) {
        throw new Error('Deck/library toggle button not found.');
      }
      return button;
    };

    fireEvent.click(toggleViewButton());

    expect(screen.queryByPlaceholderText(/search cards/i)).not.toBeInTheDocument();
    expect(screen.getByText(/current deck/i)).toBeInTheDocument();
    fireEvent.click(toggleViewButton());

    expect(screen.getByPlaceholderText(/search cards/i)).toBeInTheDocument();
    expect(screen.queryByText(/current deck/i)).not.toBeInTheDocument();
  }, 15000);

  it('routes deck builder status messages through the shared announcement callback', async () => {
    const announce = vi.fn();
    window.localStorage.setItem('ygo_saved_decks', JSON.stringify([
      {
        id: 'starter-local',
        name: 'Starter Deck',
        mainDeck: Array.from({ length: 40 }, () => 'battle-ox'),
        extraDeck: [],
        updatedAt: new Date().toISOString(),
      },
    ]));
    window.localStorage.setItem('ygo_primary_deck_id', 'starter-local');

    render(
      <AppPreferencesProvider>
        <DeckBuilder onBack={() => {}} announce={announce} />
      </AppPreferencesProvider>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith({
        title: 'Deck Builder',
        message: 'Deck saved successfully.',
      }),
    );
  });
});
