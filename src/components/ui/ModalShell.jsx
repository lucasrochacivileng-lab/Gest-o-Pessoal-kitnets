import React from 'react';
import { X } from 'lucide-react';

// Casca de modal reutilizável (fundo escurecido + card rolável). Usada pelos
// fluxos "Adicionar" de Receitas e Despesas.
export default function ModalShell({ title, subtitle, onClose, maxWidth = 'max-w-2xl', children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-3xl bg-white p-5 shadow-xl`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
