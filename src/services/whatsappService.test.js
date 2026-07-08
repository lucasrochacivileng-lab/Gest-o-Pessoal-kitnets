import { describe, expect, it } from 'vitest';
import { buildWhatsAppLink, normalizePhoneBR } from './whatsappService.js';

describe('whatsappService', () => {
  it('normaliza telefones brasileiros para o formato internacional', () => {
    expect(normalizePhoneBR('(64) 99999-8888')).toBe('5564999998888');
    expect(normalizePhoneBR('64 3411-0000')).toBe('556434110000');
    expect(normalizePhoneBR('+55 64 99999-8888')).toBe('5564999998888');
    expect(normalizePhoneBR('5564999998888')).toBe('5564999998888');
    // DDD 55 (Santa Maria-RS) não pode ser confundido com o DDI 55
    expect(normalizePhoneBR('(55) 99999-8888')).toBe('5555999998888');
    expect(normalizePhoneBR('')).toBe('');
    expect(normalizePhoneBR(null)).toBe('');
  });

  it('monta o link wa.me com a mensagem codificada', () => {
    const link = buildWhatsAppLink('(64) 99999-8888', 'Olá, tudo bem?');
    expect(link).toBe('https://wa.me/5564999998888?text=Ol%C3%A1%2C%20tudo%20bem%3F');
  });

  it('retorna null quando não há telefone', () => {
    expect(buildWhatsAppLink('', 'mensagem')).toBeNull();
    expect(buildWhatsAppLink('abc', 'mensagem')).toBeNull();
  });

  it('gera link sem query quando não há mensagem', () => {
    expect(buildWhatsAppLink('64999998888', '')).toBe('https://wa.me/5564999998888');
  });
});
