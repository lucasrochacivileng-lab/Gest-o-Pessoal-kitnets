import { CheckCircle2, Clock, X } from 'lucide-react';

const actionText = {
  Expense: {
    title: 'Essa conta já foi paga?',
    description: 'Confirme o pagamento para atualizar a despesa e registrar o histórico da notificação.',
    confirm: 'Sim, marcar como paga',
  },
  Receivable: {
    title: 'Esse aluguel já foi pago?',
    description: 'Confirme o pagamento para marcar o recebimento como pago e registrar o histórico.',
    confirm: 'Sim, marcar como pago',
  },
  Contract: {
    title: 'Esse contrato já foi tratado?',
    description: 'Confirme que a renovação, encerramento ou acompanhamento do contrato já foi tratado.',
    confirm: 'Sim, marcar como tratado',
  },
};

export function NotificationActionDialog({ entity, itemLabel, onConfirm, onSnooze, onIgnore, onClose }) {
  const text = actionText[entity] || actionText.Expense;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{text.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{text.description}</p>
            {itemLabel ? <p className="mt-3 text-sm font-medium text-slate-700">{itemLabel}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onConfirm} className="ds-btn ds-btn-success">
            <CheckCircle2 className="h-4 w-4" /> {text.confirm}
          </button>
          <button type="button" onClick={onIgnore} className="ds-btn ds-btn-secondary">
            Não
          </button>
          <button type="button" onClick={onSnooze} className="ds-btn ds-btn-secondary">
            <Clock className="h-4 w-4" /> Lembrar depois
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotificationActionDialog;
