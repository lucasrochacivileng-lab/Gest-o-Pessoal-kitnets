import React from 'react';
import { X } from 'lucide-react';

// Casca de modal reutilizável (fundo escurecido + card rolável). Usada pelos
// fluxos "Adicionar" de Receitas e Despesas.
export default function ModalShell({ title, subtitle, onClose, maxWidth = 'max-w-2xl', children }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-4">
        <div className={`max-h-[calc(100dvh-env(safe-area-inset-top))] w-full ${maxWidth} overflow-y-auto rounded-t-2xl bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:max-h-[90vh] sm:rounded-[var(--radius-2xl)] sm:p-5`}>
        <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-4 py-4 sm:static sm:m-0 sm:mb-4 sm:border-0 sm:p-0">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="ds-icon-btn" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
