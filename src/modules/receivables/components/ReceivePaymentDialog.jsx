import { useEffect, useState } from 'react';
import { ReceivableForm } from './ReceivableForm.jsx';

export function ReceivePaymentDialog({ receivable, contracts, kitnets, tenants, mode = 'payment', onSubmit, onClose }) {
  const [open, setOpen] = useState(Boolean(receivable));
  const isPaymentMode = mode === 'payment';

  useEffect(() => {
    setOpen(Boolean(receivable));
  }, [receivable]);

  if (!open || !receivable) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{isPaymentMode ? 'Receber aluguel' : 'Editar recebível'}</h2>
            <p className="text-sm text-slate-500">
              {isPaymentMode ? 'Confirme o pagamento e registre os detalhes.' : 'Atualize os dados principais da cobrança.'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Fechar</button>
        </div>
        <ReceivableForm receivable={receivable} contracts={contracts} kitnets={kitnets} tenants={tenants} mode={mode} onSubmit={onSubmit} onCancel={onClose} />
      </div>
    </div>
  );
}
