import { Save } from 'lucide-react';

export function NotificationSettings({ settings, onChange, onSave }) {
  return (
    <section className="ds-card">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-900">Configuração de alertas</h2>
        <p className="text-sm text-slate-500">
          Defina quantos dias antes o KitManager deve preparar os lembretes.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="ds-form-field">
          Contas/despesas a vencer
          <input
            type="number"
            min="0"
            value={settings.expenseAlertDays}
            onChange={(event) => onChange('expenseAlertDays', event.target.value)}
            className="ds-input"
          />
        </label>
        <label className="ds-form-field">
          Aluguéis a vencer
          <input
            type="number"
            min="0"
            value={settings.rentAlertDays}
            onChange={(event) => onChange('rentAlertDays', event.target.value)}
            className="ds-input"
          />
        </label>
        <label className="ds-form-field">
          Contratos a vencer
          <select
            value={settings.contractAlertDays}
            onChange={(event) => onChange('contractAlertDays', event.target.value)}
            className="ds-input"
          >
            <option value="30">30 dias antes</option>
            <option value="60">60 dias antes</option>
            <option value="30,60">30 e 60 dias antes</option>
          </select>
        </label>
        <label className="ds-form-field lg:col-span-2">
          E-mail padrão para contas internas
          <input
            type="email"
            value={settings.defaultRecipientEmail}
            onChange={(event) => onChange('defaultRecipientEmail', event.target.value)}
            className="ds-input"
            placeholder="seuemail@exemplo.com"
          />
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(settings.emailEnabled)}
            onChange={(event) => onChange('emailEnabled', event.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-blue-600"
          />
          Preparar envio por e-mail
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(settings.pushEnabled)}
            onChange={(event) => onChange('pushEnabled', event.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-blue-600"
          />
          Preparar Push/PWA
        </label>
      </div>

      <button type="button" onClick={onSave} className="ds-btn ds-btn-primary mt-5">
        <Save className="h-4 w-4" /> Salvar configurações
      </button>
    </section>
  );
}

export default NotificationSettings;
