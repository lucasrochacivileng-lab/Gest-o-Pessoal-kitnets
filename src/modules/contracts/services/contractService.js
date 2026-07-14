import { repository } from '../../../repository/index.js';
import { buildReceivablesForCompetence } from '../../receivables/services/receivableService.js';

// Regras de negócio do contrato de aluguel:
// - ao criar um contrato, o "carnê" inteiro é lançado (um recebível por mês
//   de vigência), como um carnê de boletos;
// - a quebra antecipada cancela os meses futuros e calcula a multa
//   proporcional ao tempo restante (padrão da Lei do Inquilinato, art. 4º).

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FINE_MONTHS = 3;

const toDate = (value) => new Date(`${String(value).slice(0, 10)}T00:00:00`);
const toMoney = (value) => Number(value || 0);
const monthOf = (value) => String(value || '').slice(0, 7);

/** Lista as competências 'YYYY-MM' do início ao fim do contrato (inclusive). */
export const listCompetences = (startDate, endDate) => {
  const start = monthOf(startDate);
  const end = monthOf(endDate);
  if (!start || start.length < 7) return [];

  const last = end && end.length === 7 ? end : start;
  const competences = [];
  let [year, month] = start.split('-').map(Number);

  while (true) {
    const competence = `${year}-${String(month).padStart(2, '0')}`;
    if (competence > last) break;
    competences.push(competence);
    if (competences.length >= 120) break; // trava de segurança: máx. 10 anos
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return competences;
};

/**
 * Multa proporcional por quebra de contrato (Lei do Inquilinato, art. 4º):
 * multa combinada (padrão 3 aluguéis) proporcional ao tempo que falta.
 * A proporção é calculada em dias para ser justa com saídas no meio do mês.
 */
export const calculateBreakFine = (contract, exitDate) => {
  const start = toDate(contract.start_date);
  const end = toDate(contract.end_date);
  const exit = toDate(exitDate);
  const fineMonths = Number(contract.fine_months) || DEFAULT_FINE_MONTHS;
  const baseFine = fineMonths * toMoney(contract.rent_value);

  if (!contract.start_date || !contract.end_date || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || Number.isNaN(exit.getTime())) {
    return { fine: 0, baseFine, fineMonths, totalDays: 0, remainingDays: 0 };
  }

  const totalDays = Math.max(Math.round((end - start) / DAY_MS), 1);
  const remainingDays = Math.min(Math.max(Math.round((end - exit) / DAY_MS), 0), totalDays);
  const fine = Math.round(baseFine * (remainingDays / totalDays) * 100) / 100;

  return { fine, baseFine, fineMonths, totalDays, remainingDays };
};

/**
 * Lança os recebíveis que faltam para o contrato (carnê completo).
 * Idempotente: competências já lançadas não duplicam.
 */
export const generateScheduleForContract = async (contract) => {
  const receivables = await repository.list('Receivable');
  const competences = listCompetences(contract.start_date, contract.end_date);
  const created = [];

  for (const competence of competences) {
    const toCreate = buildReceivablesForCompetence([contract], receivables, competence);

    for (const payload of toCreate) {
      created.push(await repository.create('Receivable', payload));
    }
  }

  return created;
};

export const contractService = {
  listCompetences,
  calculateBreakFine,
  generateScheduleForContract,

  /**
   * Fluxo "Novo aluguel": cria (ou reaproveita) o inquilino, cria o contrato,
   * marca a kitnet como ocupada e lança o carnê de recebíveis.
   */
  async createRental({ tenant, tenantId, contract }) {
    // Validação de entrada ANTES de gravar qualquer coisa: um erro aqui não
    // pode deixar um inquilino órfão (criado sem o contrato) no banco.
    // Término anterior ao início inverte a vigência: listCompetences devolve
    // [] e o "carnê" nasce vazio silenciosamente, com a kitnet marcada
    // ocupada mas sem nenhum aluguel a receber.
    if (contract.start_date && contract.end_date
      && String(contract.end_date).slice(0, 10) < String(contract.start_date).slice(0, 10)) {
      throw new Error('A data de término não pode ser anterior à data de início do contrato.');
    }

    // O <select> da tela lista a kitnet como "ocupada" só de aviso — não
    // impede escolher. Sem essa checagem aqui, um clique errado cria um
    // SEGUNDO contrato ativo pra mesma kitnet, e ela ganha dois carnês de
    // recebíveis rodando ao mesmo tempo (aluguel duplicado no caixa).
    if (contract.kitnet_id) {
      const existingContracts = await repository.list('Contract');
      const alreadyOccupied = existingContracts.some((row) => row.kitnet_id === contract.kitnet_id && row.status === 'ativo');

      if (alreadyOccupied) {
        throw new Error('Esta kitnet já tem um contrato ativo. Encerre o contrato atual antes de criar um novo.');
      }
    }

    const savedTenant = tenantId
      ? await repository.update('Tenant', tenantId, { status: 'ativo', kitnet_id: contract.kitnet_id })
      : await repository.create('Tenant', { status: 'ativo', ...tenant, kitnet_id: contract.kitnet_id, active: true });

    const savedContract = await repository.create('Contract', {
      ...contract,
      tenant_id: savedTenant.id,
      // Piso de zero (como o EntityPage já faz nos cadastros genéricos): este
      // formulário customizado de "Novo aluguel" não passa pelo EntityPage,
      // então um "-" digitado por engano no valor entraria e geraria um carnê
      // inteiro de recebíveis NEGATIVOS, subtraindo da receita em todo o app.
      rent_value: Math.max(toMoney(contract.rent_value), 0),
      due_day: Math.min(Math.max(Number(contract.due_day) || 10, 1), 31),
      fine_months: Math.max(Number(contract.fine_months) || DEFAULT_FINE_MONTHS, 0),
      status: 'ativo',
      active: true,
      created_at: new Date().toISOString(),
    });

    if (contract.kitnet_id) {
      await repository.update('Kitnet', contract.kitnet_id, { status: 'ocupada' });
    }

    const receivables = await generateScheduleForContract(savedContract);

    return { tenant: savedTenant, contract: savedContract, receivables };
  },

  /**
   * Encerra o contrato (fim normal ou quebra antecipada):
   * cancela os recebíveis pendentes dos meses após a saída, libera a kitnet
   * e, se for quebra com multa, lança a multa como recebível para cobrança.
   */
  async terminateContract(contract, { exitDate, launchFine = false }) {
    const exitMonth = monthOf(exitDate);
    // A multa usa as datas originais do contrato: calcula antes de alterar.
    const fineInfo = calculateBreakFine(contract, exitDate);

    const [receivables, contracts] = await Promise.all([
      repository.list('Receivable'),
      repository.list('Contract'),
    ]);

    // Encerra o contrato primeiro: é o estado mais importante e também
    // impede que "Completar carnê" recrie meses se algo falhar no meio.
    await repository.update('Contract', contract.id, {
      status: 'encerrado',
      end_date: String(exitDate).slice(0, 10),
      terminated_at: new Date().toISOString(),
    });

    const futureUnpaid = receivables.filter((row) => (
      row.contract_id === contract.id
      && monthOf(row.competence) > exitMonth
      && !toMoney(row.paid_value)
      && row.status !== 'pago'
    ));

    for (const row of futureUnpaid) {
      await repository.removeSoft('Receivable', row.id);
    }

    // Libera a kitnet apenas se não houver outro contrato ativo nela.
    if (contract.kitnet_id) {
      const stillOccupied = contracts.some((row) => (
        row.id !== contract.id
        && row.kitnet_id === contract.kitnet_id
        && row.status === 'ativo'
      ));

      if (!stillOccupied) {
        await repository.update('Kitnet', contract.kitnet_id, { status: 'vaga' });
      }
    }

    const tenantStillRents = contracts.some((row) => (
      row.id !== contract.id
      && row.tenant_id === contract.tenant_id
      && row.status === 'ativo'
    ));

    if (contract.tenant_id && !tenantStillRents) {
      await repository.update('Tenant', contract.tenant_id, { status: 'inativo', kitnet_id: '' });
    }

    let fineReceivable = null;

    if (launchFine && fineInfo.fine > 0) {
      fineReceivable = await repository.create('Receivable', {
        contract_id: contract.id,
        kitnet_id: contract.kitnet_id,
        tenant_id: contract.tenant_id,
        type: 'multa_quebra',
        competence: exitMonth,
        expected_value: fineInfo.fine,
        due_date: String(exitDate).slice(0, 10),
        status: 'pendente',
        notes: `Multa por quebra de contrato: ${fineInfo.fineMonths} aluguel(éis) proporcional a ${fineInfo.remainingDays} de ${fineInfo.totalDays} dias restantes.`,
        active: true,
        created_at: new Date().toISOString(),
      });
    }

    return { canceledReceivables: futureUnpaid.length, fine: fineInfo, fineReceivable };
  },
};

export default contractService;
