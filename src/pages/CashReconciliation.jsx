import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Landmark, Scale } from 'lucide-react';
import EntityPage from '../components/ui/EntityPage.jsx';
import { repository } from '../repository/index.js';
import { buildCashReconciliation } from '../services/cashReconciliationService.js';

const currency = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const accountFields = [
  { name: 'name', label: 'Conta', placeholder: 'Ex: Mercado Pago, Itau, dinheiro' },
  { name: 'institution', label: 'Banco / instituição', placeholder: 'Ex: Mercado Pago' },
  { name: 'opening_date', label: 'Data do saldo de partida', type: 'date' },
  { name: 'opening_balance', label: 'Saldo de partida (R$)', type: 'number', allowNegative: true },
  { name: 'balance_date', label: 'Data do saldo conferido', type: 'date' },
  { name: 'actual_balance', label: 'Saldo real no banco (R$)', type: 'number', allowNegative: true },
];

const movementFields = [
  { name: 'date', label: 'Data', type: 'date' },
  { name: 'type', label: 'Tipo', type: 'select', options: [
    { value: 'transferencia', label: 'Transferência entre minhas contas' },
    { value: 'entrada', label: 'Entrada ainda não cadastrada' },
    { value: 'saida', label: 'Saída ainda não cadastrada' },
    { value: 'ajuste_entrada', label: 'Ajuste positivo de saldo' },
    { value: 'ajuste_saida', label: 'Ajuste negativo de saldo' },
  ] },
  { name: 'description', label: 'Descrição', placeholder: 'Ex: Pix para Nubank' },
  { name: 'value', label: 'Valor (R$)', type: 'number' },
  { name: 'bank_account_id', label: 'Conta de origem', type: 'relation', entity: 'BankAccount' },
  { name: 'destination_account_id', label: 'Conta de destino', type: 'relation', entity: 'BankAccount', visibleWhen: (form) => form.type === 'transferencia' },
  { name: 'notes', label: 'Observações', type: 'textarea' },
];

export default function CashReconciliation() {
  const [data, setData] = useState({ accounts: [], bankMovements: [], payments: [], expenses: [], personal: [], projects: [], expertReports: [] });

  useEffect(() => {
    Promise.all([
      repository.list('BankAccount'), repository.list('BankMovement'), repository.list('Payment'),
      repository.list('Expense'), repository.list('PersonalIncome'), repository.list('ComplementaryProject'),
      repository.list('ExpertReport'),
    ]).then(([accounts, bankMovements, payments, expenses, personal, projects, expertReports]) => {
      setData({ accounts, bankMovements, payments, expenses, personal, projects, expertReports });
    });
  }, []);

  const reconciliation = useMemo(() => buildCashReconciliation(data), [data]);
  const reconciled = Math.abs(reconciliation.differenceTotal) < 0.01;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Caixa e conciliação</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Compare o saldo calculado pelo aplicativo com o dinheiro que existe nas suas contas.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="ds-card"><p className="text-xs uppercase text-slate-500">Saldo calculado</p><p className="mt-2 text-2xl font-semibold">{currency(reconciliation.calculatedTotal)}</p></div>
        <div className="ds-card"><p className="text-xs uppercase text-slate-500">Saldo real informado</p><p className="mt-2 text-2xl font-semibold">{currency(reconciliation.actualTotal)}</p></div>
        <div className={`ds-card ${reconciled ? 'border-emerald-200' : 'border-amber-200'}`}><p className="flex items-center gap-2 text-xs uppercase text-slate-500">{reconciled ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />} Diferença a conciliar</p><p className={`mt-2 text-2xl font-semibold ${reconciled ? 'text-emerald-600' : 'text-amber-700'}`}>{currency(reconciliation.differenceTotal)}</p></div>
      </div>

      {reconciliation.accounts.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{reconciliation.accounts.map((account) => <div key={account.id} className="ds-card"><div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-blue-600" /><p className="font-semibold">{account.name}</p></div><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><p className="text-xs text-slate-500">Calculado</p><p className="font-semibold">{currency(account.calculatedBalance)}</p></div><div><p className="text-xs text-slate-500">Real</p><p className="font-semibold">{currency(account.actualBalance)}</p></div><div><p className="text-xs text-slate-500">Diferença</p><p className={Math.abs(account.difference) < 0.01 ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-700'}>{currency(account.difference)}</p></div></div></div>)}</div> : null}

      <section className="border-t border-slate-200 pt-8">
        <EntityPage title="Contas e saldos" subtitle="Para começar hoje, informe o mesmo saldo de partida e saldo real, ambos com a data de hoje." entity="BankAccount" fields={accountFields} cardFields={['name', 'institution']} columns={[{ field: 'name', label: 'Conta' }, { field: 'opening_date', label: 'Início', format: 'date' }, { field: 'opening_balance', label: 'Saldo inicial', format: 'currency' }, { field: 'actual_balance', label: 'Saldo real', format: 'currency' }]} onRowsChange={(accounts) => setData((current) => ({ ...current, accounts }))} />
      </section>

      <section className="border-t border-slate-200 pt-8">
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"><Scale className="mt-0.5 h-4 w-4 flex-shrink-0" /><p>Use este cadastro para transferências entre suas contas e itens do extrato bancário que ainda não existem no app. Uma conta paga já cadastrada em Despesas deve apenas receber o vínculo da conta por lá.</p></div>
        <EntityPage title="Movimentações bancárias avulsas" entity="BankMovement" fields={movementFields} cardFields={['date', 'description', 'value']} relations={[{ key: 'BankAccount', entity: 'BankAccount' }]} columns={[{ field: 'date', label: 'Data', format: 'date' }, { field: 'description', label: 'Descrição' }, { field: 'type', label: 'Tipo' }, { field: 'value', label: 'Valor', format: 'currency' }]} onRowsChange={(bankMovements) => setData((current) => ({ ...current, bankMovements }))} />
      </section>
    </div>
  );
}
