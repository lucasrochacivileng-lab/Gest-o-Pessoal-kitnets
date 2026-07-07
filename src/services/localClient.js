import { db as seed } from '../data/mockData.js';

const STORAGE_KEY = '@kitmanager/db';
const delay = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = (value) => JSON.parse(JSON.stringify(value));

const readStorage = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return clone(seed);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return clone(seed);
  }
};

const writeStorage = (value) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
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
    const value = { id: crypto.randomUUID(), active: true, ...payload };
    db[entity] = db[entity] || [];
    db[entity].push(value);
    writeStorage(db);
    return clone(value);
  },
  async update(entity, id, payload) {
    await delay();
    const db = readStorage();
    const rows = db[entity] || [];
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new Error('Registro não encontrado');
    rows[index] = { ...rows[index], ...payload };
    writeStorage(db);
    return clone(rows[index]);
  },
  async removeSoft(entity, id) {
    await delay();
    const db = readStorage();
    const rows = db[entity] || [];
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new Error('Registro não encontrado');
    rows[index] = { ...rows[index], active: false };
    writeStorage(db);
    return clone(rows[index]);
  },
};
