import { describe, expect, it } from 'vitest';
import { formatCompetenceBR, formatDateBR } from './dateUtils.js';

describe('dateUtils', () => {
  it('formata datas ISO para o padrão brasileiro', () => {
    expect(formatDateBR('2026-07-10')).toBe('10/07/2026');
    expect(formatDateBR('2026-07-10T12:00:00Z')).toBe('10/07/2026');
    expect(formatDateBR('')).toBe('');
    expect(formatDateBR(null)).toBe('');
    expect(formatDateBR('sem data')).toBe('sem data');
  });

  it('formata competências para MM/AAAA', () => {
    expect(formatCompetenceBR('2026-07')).toBe('07/2026');
    expect(formatCompetenceBR('')).toBe('');
  });
});
