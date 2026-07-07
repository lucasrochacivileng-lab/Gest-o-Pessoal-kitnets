import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { repository } from '../repository/index.js';

export default function GenericModule({ title, entity }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { if (entity !== 'overview') repository.list(entity).then(setRows); }, [entity]);
  return <div className="space-y-5"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold text-[var(--color-text)]">{title}</h1><p className="text-sm text-[var(--color-text-muted)]">Módulo em construção com base no modelo da Base44.</p></div><button className="ds-btn ds-btn-primary"><Plus className="w-4 h-4" /> Novo</button></div><div className="ds-table"><table className="w-full text-sm"><thead><tr><th className="p-3">Registro</th><th className="p-3">Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-[var(--color-border)]"><td className="p-3 font-medium text-[var(--color-text)]">{row.name || row.description || row.client || row.title || row.id}</td><td className="p-3 text-[var(--color-text-muted)]">{row.status || '-'}</td></tr>)}{rows.length === 0 && <tr><td className="p-6 text-[var(--color-text-muted)]" colSpan="2">Nenhum registro ainda.</td></tr>}</tbody></table></div></div>;
}
