import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppPreferencesProvider, useAppPreferences } from './AppPreferencesProvider';

const PreferenceProbe = () => {
  const { language, theme, setLanguage, setTheme } = useAppPreferences();

  return (
    <div>
      <div>language:{language}</div>
      <div>theme:{theme}</div>
      <button type="button" onClick={() => setLanguage('ja')}>lang-ja</button>
      <button type="button" onClick={() => setTheme('terminal-signal')}>theme-terminal</button>
    </div>
  );
};

describe('AppPreferencesProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.lang = 'en';
  });

  it('persists guest preferences and applies them to the document root', async () => {
    render(
      <AppPreferencesProvider>
        <PreferenceProbe />
      </AppPreferencesProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'lang-ja' }));
    fireEvent.click(screen.getByRole('button', { name: 'theme-terminal' }));

    await waitFor(() => {
      expect(screen.getByText('language:ja')).toBeInTheDocument();
      expect(screen.getByText('theme:terminal-signal')).toBeInTheDocument();
    });

    expect(document.documentElement.dataset.theme).toBe('terminal-signal');
    expect(document.documentElement.lang).toBe('ja');

    expect(window.localStorage.getItem('duel-engine.preferences')).toContain('"language":"ja"');
    expect(window.localStorage.getItem('duel-engine.preferences')).toContain('"theme":"terminal-signal"');
  });
});
