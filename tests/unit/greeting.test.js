// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getGreeting } from '../../src/js/logic/greeting.js';

const at = (hour, minute = 0) => new Date(2026, 10, 16, hour, minute);

describe('getGreeting', () => {
  it.each([
    [5, 'Bom dia, Josiel'],
    [9, 'Bom dia, Josiel'],
    [11, 'Bom dia, Josiel'],
    [12, 'Boa tarde, Josiel'],
    [15, 'Boa tarde, Josiel'],
    [17, 'Boa tarde, Josiel'],
    [18, 'Boa noite, Josiel'],
    [23, 'Boa noite, Josiel'],
    [0, 'Boa noite, Josiel'],
    [4, 'Boa noite, Josiel'],
  ])('às %ih diz "%s"', (hour, expected) => {
    expect(getGreeting(at(hour))).toBe(expected);
  });

  it('muda no minuto exato da virada (11:59 -> 12:00)', () => {
    expect(getGreeting(at(11, 59))).toBe('Bom dia, Josiel');
    expect(getGreeting(at(12, 0))).toBe('Boa tarde, Josiel');
  });

  it('aceita outro nome', () => {
    expect(getGreeting(at(10), 'Ana')).toBe('Bom dia, Ana');
  });
});
