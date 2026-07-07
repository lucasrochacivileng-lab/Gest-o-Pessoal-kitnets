import { useEffect, useMemo, useState } from 'react';

const initialValues = {
  contract_id: '',
  competence: '',
  expected_value: '',
  due_date: '',
  status: 'pendente',
  notes: '',
  payment_date: new Date().toISOString().slice(0, 10),
  payment_method: 'pix',
  destination_account: 'Itaú',
  paid_value: '',
  discount: 0,
  fine: 0,
  interest: 0,
  net_value: 0,
};

export function ReceivableForm({ receivable, contracts, kitnets, tenants, onSubmit, onCancel }) {
  const [values, setValues] = useState(initialValues);

  useEffect(() => {
    if (!receivable) {
      setValues(initialValues);
      return;
    }

    setValues({
      ...initialValues,
      contract_id: receivable.contract_id || '',
      competence: receivable.competence || '',
      expected_value: receivable.expected_value || '',
      due_date: receivable.due_date || '',
      status: receivable.status || 'pendente',
      notes: receivable.notes || '',
      payment_date: new Date().toISOString().slice(0, 10),
      paid_value: receivable.expected_value || '',
    });
  }, [receivable]);

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
      const paidValue = Number(nextValues.paid_value || 0);
      const discount = Number(nextValues.discount || 0);
      const fine = Number(nextValues.fine || 0);
      const interest = Number(nextValues.interest || 0);
      nextValues.net_value = paidValue - discount + fine + interest;
    }
    setValues(nextValues);
  };

  const selectedValue = Number(values.expected_value || 0);
  useEffect(() => {
    if (!values.paid_value) {
      setValues((current) => ({ ...current, paid_value: selectedValue }));
    }
  }, [selectedValue]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      ...values,
      expected_value: Number(values.expected_value || 0),
      paid_value: Number(values.paid_value || 0),
      discount: Number(values.discount || 0),
      fine: Number(values.fine || 0),
      interest: Number(values.interest || 0),
      net_value: Number(values.net_value || 0),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-6">
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

        <div>
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
              Multa
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
              Comprovante
              <input name="receipt_url" value={values.receipt_url || ''} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" />
            </label>
            <label className="text-sm text-slate-600 md:col-span-2 xl:col-span-3">
              Observação
              <textarea name="notes" value={values.notes} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900" rows={3} />
            </label>
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button type="submit" className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">Confirmar pagamento</button>
        <button type="button" onClick={onCancel} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Cancelar</button>
      </div>
    </form>
  );
}
