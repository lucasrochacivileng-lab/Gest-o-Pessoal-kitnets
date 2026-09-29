import { describe, expect, it } from 'vitest';
import { wealthAtDate, buildWealthHistory, validateAsset, validateValuation } from './wealthService.js';
const assets = [{ id: 'house', name: 'Imóvel', kind: 'imovel', start_date: '2025-01-01' }, { id: 'loan', kind: 'divida', start_date: '2025-01-01' }];
const valuations = [
  { id: 'h1', asset_id: 'house', date: '2025-01-01', value: 200000, ownership_percent: 50, recorded_at: '2025-01-02' },
  { id: 'l1', asset_id: 'loan', date: '2025-01-01', value: 40000, ownership_percent: 100, recorded_at: '2025-01-02' },
  { id: 'h2', asset_id: 'house', date: '2025-03-01', value: 220000, ownership_percent: 50, recorded_at: '2025-03-02' },
];
describe('patrimônio com posições históricas', () => {
  it('considera participação, dívida e data sem usar avaliação futura no passado', () => {
    expect(wealthAtDate(assets, valuations, '2025-02-28').net).toBe(60000);
    expect(wealthAtDate(assets, valuations, '2025-03-31').net).toBe(70000);
    expect(wealthAtDate(assets, valuations, '2025-02-28').rows[0].carried).toBe(true);
  });
  it('não transforma falta de avaliação em zero nem inventa histórico', () => {
    expect(wealthAtDate(assets, valuations.slice(0, 1), '2025-01-31').net).toBeNull();
    expect(wealthAtDate([], [], '2025-01-31').net).toBeNull();
    expect(buildWealthHistory(assets, valuations, '2025-03', '2025-03-15')[0].net).toBeNull();
  });
  it('aceita saldo zero e correção datada sem mudar posições anteriores', () => {
    const rows = [...valuations, { id: 'l2', asset_id: 'loan', date: '2025-02-01', value: 0, ownership_percent: 100, recorded_at: '2025-02-02' }];
    expect(wealthAtDate(assets, rows, '2025-02-28').net).toBe(100000);
    expect(wealthAtDate(assets, rows, '2025-01-31').net).toBe(60000);
    rows.push({ ...valuations[0], id: 'correction', value: 210000, recorded_at: '2025-04-01' });
    expect(wealthAtDate(assets, rows, '2025-01-31').net).toBe(65000);
    expect(rows).toHaveLength(5);
  });
  it('mantém posição importada inválida como não apurada', () => {
    for (const patch of [{ value: null }, { value: '' }, { value: -1 }, { ownership_percent: undefined }, { ownership_percent: 101 }]) {
      expect(wealthAtDate(assets, [{ ...valuations[0], ...patch }, valuations[1]], '2025-01-31').net).toBeNull();
    }
  });
  it('valida cadastros e recusa números/datas/participação inválidos', () => {
    expect(() => validateAsset({ name: 'Casa', kind: 'imovel', start_date: '2025-02-30' })).toThrow();
    const valid = { date: '2025-02-01', value: 0, ownership_percent: 100, source: 'Extrato', reason: 'Quitação' };
    expect(validateValuation(valid, assets[1]).value).toBe(0);
    for (const patch of [{ value: '' }, { value: -1 }, { value: Infinity }, { ownership_percent: 101 }, { ownership_percent: 0 }, { date: '2024-01-01' }, { source: '' }]) {
      expect(() => validateValuation({ ...valid, ...patch }, assets[1])).toThrow();
    }
  });
});
