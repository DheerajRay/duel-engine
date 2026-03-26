import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App', () => {
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('starts a cpu random duel from the battlefield picker and shows the centered mode heading', async () => {
    vi.useFakeTimers();
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cpu mode/i }));

    await act(async () => {});

    expect(screen.getByText(/select deck type/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /random deck/i })[0]);

    await act(async () => {});

    expect(screen.getByText('P1 Turn')).toBeInTheDocument();
    expect(screen.getByText(/CPU Mode: Random Deck/i)).toBeInTheDocument();

    const playerDeck = screen.getAllByTitle('Main Deck').at(-1) as HTMLElement;
    fireEvent.click(playerDeck);

    await act(async () => {});

    const overlay = container.querySelector('div.absolute.inset-0.z-40') as HTMLElement;

    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain('absolute');
    expect(overlay.className).not.toContain('fixed');
    expect(within(overlay).getByText('Duel Event')).toBeInTheDocument();
    expect(within(overlay).getByText(/Duel start\. Opponent goes first\./i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2300);
    });
  });

  it('starts a cpu custom duel for a new user by seeding the starter deck as the saved custom deck', async () => {
    vi.useFakeTimers();

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cpu mode/i }));

    await act(async () => {});

    fireEvent.click(screen.getAllByRole('button', { name: /custom deck/i })[0]);

    await act(async () => {});

    expect(screen.getByText('P1 Turn')).toBeInTheDocument();
    expect(screen.getByText(/CPU Mode: Custom Deck/i)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('ygo_custom_deck') || '[]').length).toBeGreaterThanOrEqual(40);
    expect(window.localStorage.getItem('ygo_primary_deck_id')).toBeTruthy();
  });

  it('starts competition mode for a new user by using the starter deck as the initial saved custom deck', async () => {
    vi.useFakeTimers();

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /competition mode/i }));

    await act(async () => {});

    expect(screen.getByText('P1 Turn')).toBeInTheDocument();
    expect(screen.getByText(/Stage 1 of 5: Joey Wheeler/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Joey grins\./i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Joey Wheeler LP/i).length).toBeGreaterThan(0);
    expect(JSON.parse(window.localStorage.getItem('ygo_custom_deck') || '[]').length).toBeGreaterThanOrEqual(40);
  });
});
