import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, Building2, Gavel, Briefcase } from 'lucide-react';
import ModalShell from '../../components/ui/ModalShell.jsx';
import { repository } from '../../repository/index.js';
import { receivableService } from '../../modules/receivables/services/receivableService.js';
import { ReceivePaymentDialog } from '../../modules/receivables/components/ReceivePaymentDialog.jsx';

const today = () => new Date().toISOString().slice(0, 10);
const contractLabel = (contract, kitnetById, tenantById) => {
  const kitnet = kitnetById.get(contract.kitnet_id);
  const tenant = tenantById.get(contract.tenant_id);
  return [kitnet?.name, tenant?.name].filter(Boolean).join(' — ') || contract.id;
};

const TYPES = [
  { key: 'salario', label: 'Salário / renda pessoal', icon: Banknote, desc: 'Lançamento livre (salário, extra...)' },
  { key: 'aluguel', label: 'Aluguel de kitnet', icon: Building2, desc: 'Confirma o recebimento de um contrato' },
  { key: 'pericia', label: 'Perícia', icon: Gavel, desc: 'Registra recebimento de uma perícia cadastrada' },
  { key: 'projeto', label: 'Projeto', icon: Briefcase, desc: 'Registra recebimento de um projeto cadastrado' },
];

const Shell = ModalShell;

// Passo 1: escolher o tipo de receita.
function TypePicker({ onPick, onClose }) {
  return (
    <Shell title="Adicionar receita" subtitle="Escolha a origem — projetos, perícias e aluguéis são vinculados a um cadastro." onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        {TYPES.map(({ key, label, icon: Icon, desc }) => (
          <button
            key={key}
            type="button"
            onClick={() => onPick(key)}
            className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-4 text-left transition hover:border-blue-500 hover:bg-blue-50"
          >
            <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Icon className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold text-slate-900">{label}</span>
              <span className="block text-xs text-slate-500">{desc}</span>
            </span>
          </button>
        ))}
      </div>
    </Shell>
  );
}

const inputClass = 'ds-input';

// Renda pessoal / salário → cria um PersonalIncome (type income).
function SalarioForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ description: 'Salário', value: '', date: today(), context: 'trabalho', status: 'recebido', recurring: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await repository.create('PersonalIncome', {
        type: 'income',
        context: form.context,
        description: form.description,
        category: form.context === 'trabalho' ? 'salário' : (form.category || ''),
        value: Math.max(Number(form.value || 0), 0),
        date: form.date,
        status: form.status,
        recurring: Boolean(form.recurring),
        active: true,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell title="Salário / renda pessoal" subtitle="Lançamento livre — vai para Finanças Pessoais." onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="ds-form-field sm:col-span-2">Descrição
          <input className={inputClass} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ex: Salário servidor" />
        </label>
        <label className="ds-form-field">Valor (R$)
          <input type="number" className={inputClass} value={form.value} onChange={(e) => set({ value: e.target.value })} placeholder="9000" />
        </label>
        <label className="ds-form-field">Data
          <input type="date" className={inputClass} value={form.date} onChange={(e) => set({ date: e.target.value })} />
        </label>
        <label className="ds-form-field">Contexto
          <select className={inputClass} value={form.context} onChange={(e) => set({ context: e.target.value })}>
            <option value="trabalho">Trabalho / Servidor (salário)</option>
            <option value="pessoal">Pessoal (outra renda)</option>
          </select>
        </label>
        <label className="ds-form-field">Status
          <select className={inputClass} value={form.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="recebido">Recebido</option>
            <option value="previsto">Previsto</option>
          </select>
        </label>
        <label className="ds-form-field sm:col-span-2 flex-row items-center gap-3">
          <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-blue-600" checked={form.recurring} onChange={(e) => set({ recurring: e.target.checked })} />
          <span className="text-sm text-slate-600">Repete todo mês (salário, aposentadoria...)</span>
        </label>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={save} disabled={saving || !form.value} className="ds-btn ds-btn-primary disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar receita'}</button>
        <button type="button" onClick={onClose} className="ds-btn ds-btn-secondary">Cancelar</button>
      </div>
    </Shell>
  );
}

// Recebimento de perícia/projeto → update de status para 'recebido'. Entidade e
// campo de valor variam (ExpertReport.fee_value × ComplementaryProject.value).
function ExtraReceiptForm({ entity, valueField, title, listLabel, cadastroPath, onClose, onSaved }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({ received_date: today(), value: '', bank_account_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const [rows, bankAccounts] = await Promise.all([repository.list(entity), repository.list('BankAccount')]);
      setItems(rows.filter((row) => row.status !== 'recebido'));
      setAccounts(bankAccounts);
    })();
  }, [entity]);

  const selected = items.find((row) => row.id === selectedId) || null;
  useEffect(() => {
    if (selected) setForm((prev) => ({ ...prev, value: selected[valueField] ?? '' }));
  }, [selected, valueField]);

  const save = async () => {
    if (!selected) return;
    if (!form.bank_account_id) {
      setError('Selecione a conta em que o dinheiro entrou.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await repository.update(entity, selected.id, {
        status: 'recebido',
        received_date: form.received_date,
        [valueField]: Math.max(Number(form.value || 0), 0),
        bank_account_id: form.bank_account_id || '',
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell title={title} subtitle="Só é possível registrar o recebimento de um cadastro já existente." onClose={onClose}>
      {items.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nenhum {listLabel} aguardando recebimento.{' '}
          <button type="button" onClick={() => navigate(cadastroPath)} className="font-semibold underline">Cadastrar {listLabel}</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="ds-form-field sm:col-span-2">{listLabel[0].toUpperCase() + listLabel.slice(1)}
            <select className={inputClass} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Selecione</option>
              {items.map((row) => (
                <option key={row.id} value={row.id}>
                  {[row.client, row.process_number || row.project_type].filter(Boolean).join(' — ') || row.id}
                </option>
              ))}
            </select>
          </label>
          <label className="ds-form-field">Data em que recebeu
            <input type="date" className={inputClass} value={form.received_date} onChange={(e) => setForm((p) => ({ ...p, received_date: e.target.value }))} />
          </label>
          <label className="ds-form-field">Valor recebido (R$)
            <input type="number" className={inputClass} value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} />
          </label>
          <label className="ds-form-field sm:col-span-2">Conta que recebeu
            <select className={inputClass} value={form.bank_account_id} onChange={(e) => setForm((p) => ({ ...p, bank_account_id: e.target.value }))} required>
              <option value="">Selecione</option>
              {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name || acc.id}</option>)}
            </select>
          </label>
        </div>
      )}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={save} disabled={saving || !selected} className="ds-btn ds-btn-primary disabled:opacity-60">{saving ? 'Salvando...' : 'Registrar recebimento'}</button>
        <button type="button" onClick={onClose} className="ds-btn ds-btn-secondary">Cancelar</button>
      </div>
    </Shell>
  );
}

// Aluguel: escolhe o contrato, garante o recebível do mês e abre o diálogo de
// recebimento (mesmo fluxo/gravação da tela Recebimentos).
function AluguelFlow({ month, onClose, onSaved }) {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [kitnets, setKitnets] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [contractId, setContractId] = useState('');
  const [competence, setCompetence] = useState(month);
  const [receivable, setReceivable] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const [contractRows, kitnetRows, tenantRows] = await Promise.all([
        repository.list('Contract'), repository.list('Kitnet'), repository.list('Tenant'),
      ]);
      setContracts(contractRows.filter((row) => !row.status || row.status === 'ativo'));
      setKitnets(kitnetRows);
      setTenants(tenantRows);
    })();
  }, []);

  const kitnetById = useMemo(() => new Map(kitnets.map((row) => [row.id, row])), [kitnets]);
  const tenantById = useMemo(() => new Map(tenants.map((row) => [row.id, row])), [tenants]);

  const openReceiveDialog = async () => {
    setPreparing(true);
    setError('');
    try {
      // Garante o recebível do contrato/competência (gera se não existir).
      let receivables = await repository.list('Receivable');
      let found = receivables.find((row) => row.contract_id === contractId && row.competence === competence);
      if (!found) {
        await receivableService.generateForCompetence(competence);
        receivables = await repository.list('Receivable');
        found = receivables.find((row) => row.contract_id === contractId && row.competence === competence);
      }
      if (!found) {
        setError('Não há recebível para este contrato neste mês (o contrato pode não estar vigente na competência escolhida).');
        return;
      }
      setReceivable(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao preparar o recebimento.');
    } finally {
      setPreparing(false);
    }
  };

  const handlePaymentSubmit = async (values) => {
    await receivableService.registerPayment(receivable, values);
    onSaved();
  };

  if (receivable) {
    return (
      <ReceivePaymentDialog
        receivable={receivable}
        contracts={contracts}
        kitnets={kitnets}
        tenants={tenants}
        mode="payment"
        onSubmit={handlePaymentSubmit}
        onClose={() => setReceivable(null)}
      />
    );
  }

  return (
    <Shell title="Receber aluguel" subtitle="Escolha o contrato e o mês; o recebível é gerado se ainda não existir." onClose={onClose}>
      {contracts.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nenhum contrato ativo.{' '}
          <button type="button" onClick={() => navigate('/contratos')} className="font-semibold underline">Cadastrar contrato</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="ds-form-field sm:col-span-2">Contrato (kitnet — locatário)
            <select className={inputClass} value={contractId} onChange={(e) => setContractId(e.target.value)}>
              <option value="">Selecione</option>
              {contracts.map((contract) => (
                <option key={contract.id} value={contract.id}>{contractLabel(contract, kitnetById, tenantById)}</option>
              ))}
            </select>
          </label>
          <label className="ds-form-field">Mês (competência)
            <input type="month" className={inputClass} value={competence} onChange={(e) => setCompetence(e.target.value)} />
          </label>
        </div>
      )}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={openReceiveDialog} disabled={!contractId || preparing} className="ds-btn ds-btn-primary disabled:opacity-60">
          {preparing ? 'Preparando...' : 'Continuar'}
        </button>
        <button type="button" onClick={onClose} className="ds-btn ds-btn-secondary">Cancelar</button>
      </div>
    </Shell>
  );
}

export default function AddIncomeModal({ month, onClose, onSaved }) {
  const [type, setType] = useState('');

  const done = () => { onSaved(); };

  if (!type) return <TypePicker onPick={setType} onClose={onClose} />;
  if (type === 'salario') return <SalarioForm onClose={onClose} onSaved={done} />;
  if (type === 'aluguel') return <AluguelFlow month={month} onClose={onClose} onSaved={done} />;
  if (type === 'pericia') {
    return <ExtraReceiptForm entity="ExpertReport" valueField="fee_value" title="Receber perícia" listLabel="perícia" cadastroPath="/pericias" onClose={onClose} onSaved={done} />;
  }
  return <ExtraReceiptForm entity="ComplementaryProject" valueField="value" title="Receber projeto" listLabel="projeto" cadastroPath="/projetos" onClose={onClose} onSaved={done} />;
}
