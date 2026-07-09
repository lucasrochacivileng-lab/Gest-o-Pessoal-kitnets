import { describe, expect, it } from 'vitest';
import { calculateBreakFine, contractService, listCompetences } from './contractService.js';
import { repository } from '../../../repository/index.js';

describe('contractService', () => {
  it('lista as competências do início ao fim do contrato', () => {
    expect(listCompetences('2026-08-01', '2027-07-31')).toHaveLength(12);
    expect(listCompetences('2026-08-01', '2027-07-31')[0]).toBe('2026-08');
    expect(listCompetences('2026-08-01', '2027-07-31')[11]).toBe('2027-07');
    expect(listCompetences('2026-08-01', '2026-08-20')).toEqual(['2026-08']);
    expect(listCompetences('', '')).toEqual([]);
  });

  it('calcula a multa proporcional por quebra de contrato', () => {
    const contract = {
      start_date: '2026-01-01',
      end_date: '2026-12-31', // 364 dias
      rent_value: 800,
      fine_months: 3,
    };

    // saída na metade exata -> metade da multa cheia (3 x 800 = 2400)
    const half = calculateBreakFine(contract, '2026-07-02'); // 182 de 364 dias restantes
    expect(half.baseFine).toBe(2400);
    expect(half.fine).toBe(1200);

    // saída no último dia -> multa zero
    expect(calculateBreakFine(contract, '2026-12-31').fine).toBe(0);

    // sem datas -> multa zero, sem quebrar
    expect(calculateBreakFine({ rent_value: 800 }, '2026-07-01').fine).toBe(0);
  });

  it('cria aluguel completo: inquilino, contrato, kitnet ocupada e carnê', async () => {
    const kitnet = await repository.create('Kitnet', { name: 'Kitnet Teste Carnê', status: 'vaga', active: true });

    const result = await contractService.createRental({
      tenant: { name: 'Inquilino Carnê', phone: '64 99999-0000' },
      contract: {
        kitnet_id: kitnet.id,
        start_date: '2026-08-01',
        end_date: '2027-07-31',
        rent_value: 800,
        due_day: 10,
        fine_months: 3,
      },
    });

    expect(result.contract.status).toBe('ativo');
    expect(result.receivables).toHaveLength(12);
    expect(result.receivables[0].competence).toBe('2026-08');
    expect(result.receivables[0].due_date).toBe('2026-08-10');

    const kitnets = await repository.list('Kitnet');
    expect(kitnets.find((row) => row.id === kitnet.id).status).toBe('ocupada');

    // idempotente: gerar de novo não duplica
    const again = await contractService.generateScheduleForContract(result.contract);
    expect(again).toHaveLength(0);
  });

  it('encerra contrato: cancela meses futuros, libera kitnet e lança multa', async () => {
    const kitnet = await repository.create('Kitnet', { name: 'Kitnet Teste Quebra', status: 'vaga', active: true });

    const { contract } = await contractService.createRental({
      tenant: { name: 'Inquilino Quebra' },
      contract: {
        kitnet_id: kitnet.id,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        rent_value: 1000,
        due_day: 5,
        fine_months: 3,
      },
    });

    const result = await contractService.terminateContract(contract, {
      exitDate: '2026-07-02',
      launchFine: true,
    });

    // meses de agosto a dezembro cancelados (julho, mês da saída, permanece)
    expect(result.canceledReceivables).toBe(5);
    expect(result.fine.fine).toBe(1500); // metade de 3 x 1000
    expect(result.fineReceivable).toBeTruthy();
    expect(result.fineReceivable.type).toBe('multa_quebra');

    const contracts = await repository.list('Contract');
    expect(contracts.find((row) => row.id === contract.id).status).toBe('encerrado');

    const kitnets = await repository.list('Kitnet');
    expect(kitnets.find((row) => row.id === kitnet.id).status).toBe('vaga');

    const receivables = await repository.list('Receivable');
    const remaining = receivables.filter((row) => row.contract_id === contract.id && row.type !== 'multa_quebra');
    expect(remaining).toHaveLength(7); // janeiro a julho
  });

  it('recusa criar um segundo contrato ativo para uma kitnet já ocupada', async () => {
    const kitnet = await repository.create('Kitnet', { name: 'Kitnet Teste Dupla Ocupação', status: 'vaga', active: true });

    await contractService.createRental({
      tenant: { name: 'Primeiro Inquilino' },
      contract: { kitnet_id: kitnet.id, start_date: '2026-01-01', end_date: '2026-12-31', rent_value: 800, due_day: 10 },
    });

    await expect(contractService.createRental({
      tenant: { name: 'Segundo Inquilino' },
      contract: { kitnet_id: kitnet.id, start_date: '2026-02-01', end_date: '2027-01-31', rent_value: 900, due_day: 5 },
    })).rejects.toThrow('já tem um contrato ativo');

    // nenhum carnê extra foi lançado pra kitnet por causa da tentativa recusada
    const receivables = await repository.list('Receivable');
    expect(receivables.filter((row) => row.kitnet_id === kitnet.id)).toHaveLength(12);
  });

  it('permite novo contrato na mesma kitnet depois que o anterior foi encerrado', async () => {
    const kitnet = await repository.create('Kitnet', { name: 'Kitnet Teste Reocupação', status: 'vaga', active: true });

    const { contract } = await contractService.createRental({
      tenant: { name: 'Inquilino Antigo' },
      contract: { kitnet_id: kitnet.id, start_date: '2026-01-01', end_date: '2026-12-31', rent_value: 800, due_day: 10 },
    });

    await contractService.terminateContract(contract, { exitDate: '2026-06-30', launchFine: false });

    await expect(contractService.createRental({
      tenant: { name: 'Inquilino Novo' },
      contract: { kitnet_id: kitnet.id, start_date: '2026-07-01', end_date: '2027-06-30', rent_value: 850, due_day: 10 },
    })).resolves.toMatchObject({ contract: { status: 'ativo' } });
  });
});
