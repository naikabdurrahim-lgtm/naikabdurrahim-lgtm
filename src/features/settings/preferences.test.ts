import { beforeEach, describe, expect, it } from 'vitest';
import { defaultPreferences, resolveAppearance, usePreferences } from './preferences';

describe('preferences', () => {
  beforeEach(() => {
    usePreferences.getState().reset();
  });

  it('starts new users in Simple Mode, Bangla and dark', () => {
    expect(defaultPreferences.mode).toBe('simple');
    expect(defaultPreferences.language).toBe('bn');
    expect(defaultPreferences.appearance).toBe('dark');
    expect(defaultPreferences.numerals).toBe('bn');
  });

  it('updates each preference independently', () => {
    const api = usePreferences.getState();
    api.setMode('pro');
    api.setAccent('amber');
    api.setFontSize('lg');
    api.setNumerals('en');

    const state = usePreferences.getState();
    expect(state.mode).toBe('pro');
    expect(state.accent).toBe('amber');
    expect(state.fontSize).toBe('lg');
    expect(state.numerals).toBe('en');
    expect(state.language).toBe('bn');
  });

  it('resolves system appearance', () => {
    expect(resolveAppearance('system', true)).toBe('dark');
    expect(resolveAppearance('system', false)).toBe('light');
    expect(resolveAppearance('light', true)).toBe('light');
    expect(resolveAppearance('dark', false)).toBe('dark');
  });

  it('reset restores every default', () => {
    usePreferences.getState().setAccent('pink');
    usePreferences.getState().reset();
    const state = usePreferences.getState();
    expect(state.accent).toBe(defaultPreferences.accent);
    expect(state.mode).toBe(defaultPreferences.mode);
  });
});
