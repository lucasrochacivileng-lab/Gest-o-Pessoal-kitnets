import { describe, expect, it } from 'vitest';
import { localClient } from './localClient.js';

describe('localClient backup', () => {
  it('exports a local database snapshot', async () => {
    const backup = await localClient.exportBackup();

    expect(Array.isArray(backup.Kitnet)).toBe(true);
    expect(Array.isArray(backup.Receivable)).toBe(true);
  });

  it('rejects malformed backup data', async () => {
    await expect(localClient.importBackup({ Kitnet: {} })).rejects.toThrow('Backup inválido');
  });
});
