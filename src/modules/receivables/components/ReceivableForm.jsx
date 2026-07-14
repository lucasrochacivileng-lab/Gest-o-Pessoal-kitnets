import { useEffect, useMemo, useState } from 'react';
import { calculateOutstandingValue } from '../services/receivableService.js';
import { repository } from '../../../repository/index.js';
import { addMoney, subtractMoney, fromCents, toCents } from '../../../services/money.js';

const initialValues = {
  contract_id: '',
  competence: '',
  expected_value: '',
  due_date: '',
  status: 'pendente',
  notes: '',
  payment_date: new Date().toISOString().slice(0, 10),
  payment_method: 'pix',
  destination_account: 'Mercado Pago',
  bank_account_id: '',
  paid_value: '',
  discount: 0,
  fine: 0,
  interest: 0,
  net_value: 0,
};

const createPaymentId = () => globalThis.crypto?.randomUUID?.()
  || `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const calculateNetValue = (values) => {
  return addMoney(subtractMoney(values.paid_value, values.discount), values.fine, values.interest);
};

export function ReceivableForm({ receivable, contracts, kitnets, tenants, mode = 'payment', onSubmit, onCancel }) {
  const [values, setValues] = useState(initialValues);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankAccountsError, setBankAccountsError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const [paymentId, setPaymentId] = useState(createPaymentId);
  const isPaymentMode = mode === 'payment';

  useEffect(() => {
    repository.list('BankAccount')
      .then((rows) => {
        setBankAccounts(rows);
        setBankAccountsError('');
      })
      .catch(() => {
        setBankAccounts([]);
        setBankAccountsError('Nao foi possivel carregar as contas de destino.');
      });
  }, []);

  useEffect(() => {
    setPaymentId(createPaymentId());
    if (!receivable) {
      setValues(initialValues);
      return;
    }

    const outstandingValue = calculateOutstandingValue(receivable);
    const paidValue = outstandingValue || receivable.expected_value || '';
    // Contrato prevê multa de 10% sobre o valor devido em caso de atraso — sugerida
    // automaticamente para recebíveis vencidos (o valor continua editável).
    const suggestedFine = mode === 'payment' && receivable.status === 'vencido'
      ? fromCents(Math.round(toCents(paidValue) * 0.10))
      : 0;

    setValues({
      ...initialValues,
      contract_id: receivable.contract_id || '',
      competence: receivable.competence || '',
      expected_value: receivable.expected_value || '',
      due_date: receivable.due_date || '',
      status: receivable.status || 'pendente',
      notes: receivable.notes || '',
      payment_date: new Date().toISOString().slice(0, 10),
      paid_value: paidValue,
      fine: suggestedFine,
      net_value: addMoney(paidValue, suggestedFine),
      destination_account: receivable.destination_account || initialValues.destination_account,
    });
  }, [mode, receivable]);

  const selectedContract = useMemo(() => contracts.find((contract) => contract.id === values.contract_id) || null, [contracts, values.contract_id]);
  const selectedKitnet = useMemo(() => kitnets.find((kitnet) => kitnet.id === selectedContract?.kitnet_id) || null, [kitnets, selectedContract]);
  const selectedTenant = useMemo(() => tenants.find((tenant) => tenant.id === selectedContract?.tenant_id) || null, [tenants, selectedContract]);

  useEffect(() => {
    if (!receivable) {
      return;
    }
  }, [receivable]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValues = { ...values, [name]: value };
    if (name === 'paid_value' || name === 'discount' || name === 'fine' || name === 'interest') {
      nextValues.net_value = calculateNetValue(nextValues);
    }
    setValues(nextValues);
  };

  const selectedValue = Number(values.expected_value || 0);
  useEffect(() => {
    if (!values.paid_value) {
      setValues((current) => {
        const nextValues = { ...current, paid_value: selectedValue };
        return { ...nextValues, net_value: calculateNetValue(nextValues) };
      });
    }
  }, [selectedValue]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSubmitError('');
    try {
      await onSubmit({
        ...values,
        ...(isPaymentMode ? { payment_id: paymentId } : {}),
        expected_value: fromCents(toCents(values.expected_value)),
        paid_value: fromCents(toCents(values.paid_value)),
        discount: fromCents(toCents(values.discount)),
        fine: fromCents(toCents(values.fine)),
        interest: fromCents(toCents(values.interest)),
        net_value: fromCents(toCents(values.net_value)),
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Nao foi possivel concluir a operacao.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-6">
        {submitError ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        ) : null}
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Dados do aluguel</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600">
              Kitnet
              <select name="contract_id" value={values.contract_id} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900">
                <option value="">Selecione</option>
                {contracts.map((contract) => <option key={contract.id} value={contract.id}>{kitnets.find((kitnet) => kitnet.id === contract.kitnet_id)?.name || contract.id}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Locatário
              <input value={selectedTenant?.name || ''} readOnly className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            </label>
            <label className="text-sm text-slate-600">
              Competência
              <input name="competence" value={values.competence} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            </label>
            <label className="text-sm text-slate-600">
              Valor previsto
              <input name="expected_value" value={values.expected_value} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            </label>
            <label className="text-sm text-slate-600">
              Vencimento
              <input type="date" name="due_date" value={values.due_date} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            </label>
            <label className="text-sm text-slate-600">
              Status
              <input value={values.status} readOnly className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            </label>
          </div>
        </div>

        {isPaymentMode ? <div>
          <h3 className="text-lg font-semibold text-slate-900">Pagamento</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm text-slate-600">
              Valor pago
              <input name="paid_value" type="number" value={values.paid_value} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            </label>
            <label className="text-sm text-slate-600">
              Desconto
              <input name="discount" type="number" value={values.discount} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            </label>
            <label className="text-sm text-slate-600">
              Multa (10% sugerida em atrasos)
              <input name="fine" type="number" value={values.fine} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            </label>
            <label className="text-sm text-slate-600">
              Juros
              <input name="interest" type="number" value={values.interest} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            </label>
            <label className="text-sm text-slate-600">
              Total líquido recebido
              <input value={values.net_value} readOnly className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            </label>
            <label className="text-sm text-slate-600">
              Data do pagamento
              <input type="date" name="payment_date" value={values.payment_date} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            </label>
            <label className="text-sm text-slate-600">
              Forma de pagamento
              <input name="payment_method" value={values.payment_method} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            </label>
            <label className="text-sm text-slate-600">
              Conta destino
              <input name="destination_account" value={values.destination_account} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            </label>
            <label className="text-sm text-slate-600">
              Conta que recebeu
              <select name="bank_account_id" value={values.bank_account_id} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900">
                <option value="">Selecione</option>
                {bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
              {bankAccountsError ? <span className="mt-1 block text-xs text-red-600">{bankAccountsError}</span> : null}
            </label>
            <label className="text-sm text-slate-600">
              Comprovante
              <input name="receipt_url" value={values.receipt_url || ''} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            </label>
            <label className="text-sm text-slate-600 md:col-span-2 xl:col-span-3">
              Observação
              <textarea name="notes" value={values.notes} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" rows={3} />
            </label>
          </div>
        </div> : (
          <label className="text-sm text-slate-600">
            Observação
            <textarea name="notes" value={values.notes} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" rows={3} />
          </label>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <button type="submit" disabled={saving} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? 'Salvando...' : (isPaymentMode ? 'Confirmar pagamento' : 'Salvar alterações')}
        </button>
        <button type="button" onClick={onCancel} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Cancelar</button>
      </div>
    </form>
  );
}
