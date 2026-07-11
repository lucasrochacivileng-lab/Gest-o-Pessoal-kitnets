import { describe, expect, it } from 'vitest';
import { getActiveContract } from './index.jsx';

describe('getActiveContract', () => {
  it('nao cai para um contrato encerrado quando nao ha nenhum ativo', () => {
    // Regressao: kitnet vaga (sem contrato ativo) nao pode mostrar o
    // ex-locatario do ultimo contrato encerrado como se fosse o atual, nem
    // anexar um novo PDF de contrato/vistoria ao tenant_id de quem ja saiu.
    const contracts = [
      { id: 'c1', tenant_id: 't1', status: 'encerrado' },
    ];

    expect(getActiveContract(contracts)).toBeNull();
  });

  it('retorna o contrato ativo quando existe, mesmo com contratos encerrados na lista', () => {
    const contracts = [
      { id: 'c1', tenant_id: 't1', status: 'encerrado' },
      { id: 'c2', tenant_id: 't2', status: 'ativo' },
    ];

    expect(getActiveContract(contracts)?.id).toBe('c2');
  });

  it('retorna null para uma lista vazia', () => {
    expect(getActiveContract([])).toBeNull();
  });
});
