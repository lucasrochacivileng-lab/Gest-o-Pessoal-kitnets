import { Download, X } from 'lucide-react';
import { financialService } from '../../../services/financialService';

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function openPrintableHtml(html) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const receiptWindow = window.open(url, '_blank');

  if (receiptWindow) {
    receiptWindow.focus();
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function printReceipt(receivable, payment) {
  const currency = financialService.formatCurrency;
  const receiptNumber = escapeHtml(payment.receipt_number || payment.id);
  const tenantName = escapeHtml(receivable.tenant?.name || 'Locatário não informado');
  const competence = escapeHtml(receivable.competence);
  const kitnetName = escapeHtml(receivable.kitnet?.name || 'não informada');
  const paymentDate = escapeHtml(payment.payment_date || '-');
  const paymentMethod = escapeHtml(payment.payment_method || '-');
  const destinationAccount = escapeHtml(payment.destination_account || '-');
  const notes = escapeHtml(payment.notes || '');
  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Recibo ${receiptNumber}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; margin: 40px; }
      .box { border: 1px solid #cbd5e1; border-radius: 12px; padding: 28px; }
      h1 { font-size: 24px; margin: 0 0 8px; }
      p { line-height: 1.5; }
      .muted { color: #64748b; font-size: 13px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 24px; }
      .item { background: #f8fafc; border-radius: 10px; padding: 12px; }
      .sign { margin-top: 64px; text-align: center; }
      .line { border-top: 1px solid #334155; width: 280px; margin: 0 auto 8px; }
      @media print { button { display: none; } body { margin: 20px; } }
    </style>
  </head>
  <body>
    <button onclick="window.print()">Imprimir / salvar em PDF</button>
    <div class="box">
      <p class="muted">Recibo nº ${receiptNumber}</p>
      <h1>Recibo de pagamento de aluguel</h1>
      <p>Recebemos de <strong>${tenantName}</strong> o valor de <strong>${currency(payment.paid_value)}</strong>, referente ao aluguel da competência <strong>${competence}</strong> da unidade <strong>${kitnetName}</strong>.</p>
      <div class="grid">
        <div class="item"><span class="muted">Data</span><br />${paymentDate}</div>
        <div class="item"><span class="muted">Forma</span><br />${paymentMethod}</div>
        <div class="item"><span class="muted">Valor líquido</span><br />${currency(financialService.netPaymentValue(payment))}</div>
        <div class="item"><span class="muted">Conta destino</span><br />${destinationAccount}</div>
      </div>
      <p class="muted">Desconto: ${currency(payment.discount || 0)} · Multa: ${currency(payment.fine || 0)} · Juros: ${currency(payment.interest || 0)}</p>
      ${notes ? `<p>Observação: ${notes}</p>` : ''}
      <div class="sign">
        <div class="line"></div>
        <p>Assinatura</p>
      </div>
    </div>
  </body>
</html>`;

  openPrintableHtml(html);
}

export function ReceivableHistoryDialog({ receivable, onClose }) {
  if (!receivable) return null;

  const payments = receivable.payments || [];
  const currency = financialService.formatCurrency;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Histórico de pagamentos</h2>
            <p className="mt-1 text-sm text-slate-500">
              Competência {receivable.competence} · {receivable.tenant?.name || 'Locatário não informado'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {payments.length ? payments.map((payment) => (
            <div key={payment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{currency(payment.paid_value)}</p>
                  <p className="text-xs text-slate-500">
                    Recibo {payment.receipt_number || payment.id} · {payment.payment_date || 'Data não informada'} · {payment.payment_method || 'Forma não informada'}
                  </p>
                </div>
                <div className="space-y-2 text-left text-xs text-slate-500 sm:text-right">
                  <div>
                    <p>Líquido: {currency(financialService.netPaymentValue(payment))}</p>
                    <p>Desconto {currency(payment.discount || 0)} · Multa {currency(payment.fine || 0)} · Juros {currency(payment.interest || 0)}</p>
                  </div>
                  <button type="button" onClick={() => printReceipt(receivable, payment)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                    <Download className="h-3.5 w-3.5" /> Recibo PDF
                  </button>
                </div>
              </div>
              {payment.notes ? <p className="mt-3 text-sm text-slate-600">{payment.notes}</p> : null}
            </div>
          )) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Nenhum pagamento registrado para este recebível.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
