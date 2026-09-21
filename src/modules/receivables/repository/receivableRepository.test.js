import { describe, expect, it, vi, beforeEach } from 'vitest';
import receivableRepository from './receivableRepository.js';
import { repository as appRepository } from '../../../repository/index.js';
import { RECEIVABLE_STATUS } from '../types/receivable.types.js';

// O status vive dentro de um jsonb livre, sem constraint no banco. Sem a guarda
// de escrita, qualquer string entrava (foi assim que 'previsto' e 'nao alugada'
// contaminaram 27% dos registros e sumiram dos totais que filtram por status).
describe('receivableRepository - guarda de status', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejeita status fora do enum ao criar', async () => {
    const create = vi.spyOn(appRepository, 'create').mockResolvedValue({});

    await expect(receivableRepository.create({ status: 'previsto' })).rejects.toThrow(/inválido/i);
    await expect(receivableRepository.create({ status: 'não alugada' })).rejects.toThrow(/inválido/i);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejeita status fora do enum ao atualizar', async () => {
    const update = vi.spyOn(appRepository, 'update').mockResolvedValue({});

    await expect(receivableRepository.update('r1', { status: 'sei la' })).rejects.toThrow(/inválido/i);
    expect(update).not.toHaveBeenCalled();
  });

  it('aceita todos os status validos, inclusive cancelado', async () => {
    const create = vi.spyOn(appRepository, 'create').mockResolvedValue({});

    for (const status of Object.values(RECEIVABLE_STATUS)) {
      await receivableRepository.create({ status });
    }

    expect(create).toHaveBeenCalledTimes(Object.values(RECEIVABLE_STATUS).length);
  });

  it('deixa passar payload sem status (edicao parcial nao mexe no campo)', async () => {
    const update = vi.spyOn(appRepository, 'update').mockResolvedValue({});

    await receivableRepository.update('r1', { notes: 'so uma anotacao' });

    expect(update).toHaveBeenCalledWith('Receivable', 'r1', { notes: 'so uma anotacao' });
  });
});
