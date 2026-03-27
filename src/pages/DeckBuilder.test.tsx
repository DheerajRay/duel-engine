import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeckBuilder from './DeckBuilder';

describe('DeckBuilder', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('toggles between library view and deck view in the main panel', () => {
    window.localStorage.setItem('ygo_custom_deck', JSON.stringify(Array.from({ length: 40 }, () => 'battle-ox')));
    window.localStorage.setItem('ygo_custom_extra_deck', JSON.stringify(['flame-swordsman']));

    render(<DeckBuilder onBack={() => {}} />);

    expect(screen.getByPlaceholderText(/search cards/i)).toBeInTheDocument();
    expect(screen.queryByText(/current deck/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /deck view/i }));

    expect(screen.queryByPlaceholderText(/search cards/i)).not.toBeInTheDocument();
    expect(screen.getByText(/current deck/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /card view/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /card view/i }));

    expect(screen.getByPlaceholderText(/search cards/i)).toBeInTheDocument();
    expect(screen.queryByText(/current deck/i)).not.toBeInTheDocument();
  }, 15000);

  it('routes deck builder status messages through the shared announcement callback', () => {
    const announce = vi.fn();

    render(<DeckBuilder onBack={() => {}} announce={announce} />);

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(announce).toHaveBeenCalledWith({
      title: 'Deck Builder',
      message: 'Deck saved successfully.',
    });
  });
});
