import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), download: vi.fn() }));
vi.mock('./supabaseClient.js', () => ({ supabase: { rpc: mocks.rpc, storage: { from: () => mocks } } }));
import { exportRemoteBackup, importRemoteBackup } from './remoteBackupService.js';

const snapshot = () => ({ format: 'kitmanager-backup', version: 2, revision: 'revision', database: {
  records: [{ id: 'doc', entity: 'Document', active: true, data: { id: 'doc', file_path: 'original.pdf' } }],
  transactions: [], notifications: [],
}, files: [{ path: 'original.pdf', content_type: 'application/pdf', base64: btoa('pdf-content') }] });

describe('backup remoto com anexos', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.upload.mockResolvedValue({ error: null }); });
  it('exporta o snapshot e os PDFs referenciados', async () => {
    mocks.rpc.mockResolvedValue({ data: snapshot(), error: null });
    mocks.download.mockResolvedValue({ data: new Blob(['pdf-content'], { type: 'application/pdf' }), error: null });
    const result = await exportRemoteBackup();
    expect(result.files).toEqual(snapshot().files);
    expect(result.revision).toBe('revision');
  });
  it('não toca no banco nem no Storage quando faltam anexos ou revisão', async () => {
    await expect(importRemoteBackup(snapshot())).rejects.toThrow('cópia de segurança');
    await expect(importRemoteBackup({ ...snapshot(), files: [] }, { expectedRevision: 'revision' })).rejects.toThrow('faltam PDFs');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('remapeia PDFs sem sobrescrever os anteriores e envia a revisão de segurança', async () => {
    mocks.rpc.mockResolvedValue({ data: { restored: true }, error: null });
    await importRemoteBackup(snapshot(), { expectedRevision: 'current' });
    const [path, , options] = mocks.upload.mock.calls[0];
    expect(path).toMatch(/^restored\/.+\.pdf$/);
    expect(options.upsert).toBe(false);
    const [name, args] = mocks.rpc.mock.calls[0];
    expect(name).toBe('restore_application_backup');
    expect(args.p_expected_revision).toBe('current');
    expect(args.p_backup.database.records[0].data.file_path).toBe(path);
    expect(args.p_backup.files).toEqual([]);
    expect(snapshot().database.records[0].data.file_path).toBe('original.pdf');
  });
  it('não confirma sucesso quando a resposta do banco é incerta', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'Network failed' } });
    await expect(importRemoteBackup(snapshot(), { expectedRevision: 'current' })).rejects.toThrow('Confira o estado atual');
  });
});
