import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatCompetenceBR, formatDateBR, todayLocalISO } from './dateUtils.js';

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

  it('usa o dia do calendário LOCAL, mesmo no fim da noite', () => {
    // 23h30 do dia 11 no fuso local. Em UTC-3 isso já é dia 12 em UTC, e é
    // exatamente aí que `new Date().toISOString()` erra o dia.
    expect(todayLocalISO(new Date(2026, 7, 11, 23, 30, 0))).toBe('2026-08-11');
    expect(todayLocalISO(new Date(2026, 0, 1, 0, 5, 0))).toBe('2026-01-01');
  });

  // Guarda de regressão para todo o app, não só para este módulo: recortar
  // `new Date().toISOString()` devolve o DIA (slice 0,10) ou o MÊS (slice 0,7)
  // em UTC. Entre 21h e meia-noite no horário de Brasília o UTC já virou, e o
  // formulário passa a sugerir a data de AMANHÃ — um aluguel recebido às 22h
  // ficava gravado no dia seguinte e parava de bater com o extrato do banco.
  // No último dia do mês, o mesmo recorte abre a tela no mês seguinte, vazia.
  //
  // O que continua liberado, de propósito:
  //   - `new Date().toISOString()` INTEIRO, para created_at/updated_at: um
  //     timestamp em UTC é exatamente o que se quer gravar ali;
  //   - `.toISOString()` sobre data montada com `Date.UTC(...)`, que é como os
  //     serviços de ciclo de fatura trabalham.
  it('nenhum arquivo do app recorta "hoje" a partir de UTC', () => {
    const offenders = [];
    const walk = (dir) => {
      readdirSync(dir).forEach((entry) => {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) return walk(path);
        if (!/\.(js|jsx|ts|tsx)$/.test(entry) || entry.includes('.test.')) return undefined;
        if (/new Date\(\)\s*\.toISOString\(\)\s*\.slice\(\s*0\s*,\s*(7|10)\s*\)/.test(readFileSync(path, 'utf8'))) {
          offenders.push(path);
        }
        return undefined;
      });
    };
    walk('src');

    expect(offenders).toEqual([]);
  });
});
