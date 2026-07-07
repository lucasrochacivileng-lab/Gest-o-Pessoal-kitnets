import { db as seed } from '../data/mockData.js';

const STORAGE_KEY = '@kitmanager/db';
const delay = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = (value) => JSON.parse(JSON.stringify(value));

let memoryDb = clone(seed);

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
    storage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return clone(seed);
  }
};

const writeStorage = (value) => {
  const storage = getBrowserStorage();

  if (!storage) {
    memoryDb = clone(value);
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(value));
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
  async list(entity) {
    await delay();
    const db = readStorage();
    return clone((db[entity] || []).filter((row) => row.active !== false));
  },

  async create(entity, payload) {
    await delay();
    const db = readStorage();
    const value = { id: createId(), active: true, ...payload };
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

    rows[index] = { ...rows[index], ...payload };
    writeStorage(db);
    return clone(rows[index]);
  },

  async removeSoft(entity, id) {
    return this.update(entity, id, { active: false });
  },
};
