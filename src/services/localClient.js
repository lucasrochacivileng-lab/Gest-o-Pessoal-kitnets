import { db as seed } from '../data/mockData.js';
import { mutateLocalPayment, paymentSnapshot, syncLocalRentNotifications } from './financialMutations.js';
import { validateRecordBackup } from './backupValidation.js';

const STORAGE_KEY = '@kitmanager/db';
// Microtarefa em vez de setTimeout: mantém a API assíncrona sem sofrer o
// estrangulamento de timers que o navegador aplica a abas em segundo plano
// (setTimeout vira 1s+ em aba oculta, travando operações encadeadas como
// o lançamento do carnê de 12 meses).
const delay = () => Promise.resolve();
const clone = (value) => JSON.parse(JSON.stringify(value));

let memoryDb = clone(seed);
const emptyDb = () => Object.keys(seed).reduce((acc, entity) => ({ ...acc, [entity]: [] }), {});

const getBrowserStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
};

const readStorage = () => {
  const storage = getBrowserStorage();

  if (!storage) {
    return clone(memoryDb);
  }

  const raw = storage.getItem(STORAGE_KEY);

  if (!raw) {
    storage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return clone(seed);
  }

  try {
    return JSON.parse(raw);
  } catch {
    // NAO reseta pra dados de demonstracao aqui: como nao existe backup,
    // sobrescrever silenciosamente o banco real do usuario por um JSON
    // corrompido apagaria tudo sem aviso. Guarda o conteudo bruto numa
    // chave separada (pra dar chance de recuperacao manual) e propaga o
    // erro, em vez de seguir escondendo o problema com dados fake.
    storage.setItem(`${STORAGE_KEY}.corrupted-${Date.now()}`, raw);
    throw new Error('Os dados salvos neste navegador estao corrompidos e nao puderam ser lidos. Nada foi apagado.');
  }
};

const writeStorage = (value) => {
  const storage = getBrowserStorage();

  if (!storage) {
    memoryDb = clone(value);
    return;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    throw new Error('Não foi possível salvar: o navegador atingiu o limite de espaço para este site. Remova algum anexo (PDF) e tente novamente.');
  }
};

const ensureEntity = (db, entity) => {
  if (!db[entity]) {
    db[entity] = [];
  }

  return db[entity];
};

const createId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const localClient = {
  async payReceivable(receivable, values) {
    const db = readStorage();
    const result = mutateLocalPayment(db, { id: values.payment_id || createId(), receivableId: receivable.id, values });
    writeStorage(db);
    return clone(result);
  },
  async correctPayment(payment, values) {
    const db = readStorage();
    const result = mutateLocalPayment(db, { id: payment.id, values, previous: paymentSnapshot(payment), justification: values.justification });
    writeStorage(db);
    return clone(result);
  },
  async reversePayment(payment, justification) {
    const db = readStorage();
    const result = mutateLocalPayment(db, { id: payment.id, previous: paymentSnapshot(payment), reverse: true, justification });
    writeStorage(db);
    return clone(result);
  },
  async terminateContract(contractId, { exitDate, launchFine, fine }) {
    const db = readStorage();
    const contract = (db.Contract || []).find((row) => row.id === contractId && row.active !== false);
    if (!contract) throw new Error('Contrato não encontrado.');
    if (contract.status === 'encerrado') return clone(contract.termination_result || { canceledReceivables: 0, fine, fineReceivable: null });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exitDate) || !Number.isFinite(Date.parse(exitDate)) || exitDate < contract.start_date) throw new Error('Informe uma data de saída válida, a partir do início do contrato.');
    const future = (db.Receivable || []).filter((row) => row.active !== false && row.contract_id === contractId
      && row.competence > exitDate.slice(0, 7) && !Number(row.paid_value) && row.status !== 'pago');
    future.forEach((row) => { row.active = false; row.status = 'cancelado'; syncLocalRentNotifications(db, row); });
    contract.original_end_date = contract.end_date;
    contract.end_date = exitDate;
    contract.status = 'encerrado';
    contract.terminated_at = new Date().toISOString();
    const others = db.Contract.filter((row) => row.id !== contractId && row.active !== false && row.status === 'ativo');
    if (!others.some((row) => row.kitnet_id === contract.kitnet_id)) {
      const kitnet = (db.Kitnet || []).find((row) => row.id === contract.kitnet_id);
      if (kitnet) kitnet.status = 'vaga';
    }
    if (!others.some((row) => row.tenant_id === contract.tenant_id)) {
      const tenant = (db.Tenant || []).find((row) => row.id === contract.tenant_id);
      if (tenant) Object.assign(tenant, { status: 'inativo', kitnet_id: '' });
    }
    let fineReceivable = null;
    if (launchFine && fine.fine > 0) {
      fineReceivable = { id: createId(), active: true, contract_id: contractId, kitnet_id: contract.kitnet_id,
        tenant_id: contract.tenant_id, bank_account_id: contract.bank_account_id || '', type: 'multa_quebra',
        competence: exitDate.slice(0, 7), due_date: exitDate, expected_value: fine.fine, paid_value: 0, status: 'pendente' };
      (db.Receivable ||= []).push(fineReceivable);
    }
    const result = { canceledReceivables: future.length, fine, fineReceivable };
    contract.termination_result = result;
    writeStorage(db);
    return clone(result);
  },
  async list(entity) {
    await delay();
    const db = readStorage();
    return clone((db[entity] || []).filter((row) => row.active !== false));
  },

  async create(entity, payload) {
    await delay();
    const db = readStorage();
    const value = {
      id: createId(),
      active: true,
      created_by: 'local-user',
      updated_by: 'local-user',
      ...payload,
    };
    ensureEntity(db, entity).push(value);
    writeStorage(db);
    return clone(value);
  },

  async update(entity, id, payload) {
    await delay();
    const db = readStorage();
    const rows = ensureEntity(db, entity);
    const index = rows.findIndex((row) => row.id === id);

    if (index < 0) {
      throw new Error(`Registro não encontrado em ${entity}: ${id}`);
    }

    rows[index] = { ...rows[index], ...payload, updated_by: 'local-user' };
    writeStorage(db);
    return clone(rows[index]);
  },

  async removeSoft(entity, id) {
    return this.update(entity, id, { active: false });
  },

  async exportBackup() {
    await delay();
    return clone(readStorage());
  },

  async importBackup(value) {
    await delay();
    validateRecordBackup(value);
    writeStorage(value);
    return clone(value);
  },

  async resetData() {
    await delay();
    const value = emptyDb();
    writeStorage(value);
    return clone(value);
  },
};
