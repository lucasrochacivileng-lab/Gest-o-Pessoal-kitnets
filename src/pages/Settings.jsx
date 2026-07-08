import { useEffect, useRef, useState } from 'react';
import { Download, RotateCcw, Save, Upload } from 'lucide-react';
import { repository } from '../repository/index.js';

const SETTINGS_KEY = '@kitmanager/settings';

const defaultSettings = {
  currency: 'BRL',
  contractAlertDays: '30',
  whatsappReminders: true,
};

function readSettings() {
  if (typeof window === 'undefined') return defaultSettings;

  try {
    return { ...defaultSettings, ...JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return defaultSettings;
  }
}

export default function Settings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    setSettings(readSettings());
  }, []);

  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const saveSettings = () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setMessage('Configurações salvas.');
  };

  const downloadBackupFile = (backup, filename) => {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportBackup = async () => {
    const backup = await repository.exportBackup();
    downloadBackupFile(backup, `kitmanager-backup-${new Date().toISOString().slice(0, 10)}.json`);
    setMessage('Backup exportado.');
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      'Importar substitui TODOS os dados atuais pelos do arquivo. '
      + 'Uma cópia de segurança dos dados atuais será baixada antes. Continuar?',
    );

    if (!confirmed) {
      event.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // Cópia de segurança dos dados atuais antes de qualquer alteração.
      const safetyCopy = await repository.exportBackup();
      downloadBackupFile(safetyCopy, `kitmanager-backup-seguranca-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)}.json`);

      await repository.importBackup(parsed);
      setMessage('Backup importado. Recarregue a página para atualizar todos os módulos.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível importar o backup.');
    } finally {
      event.target.value = '';
    }
  };

  const resetData = async () => {
    const confirmed = window.confirm('Resetar a base local e apagar todos os dados salvos neste navegador?');
    if (!confirmed) return;

    await repository.resetData();
    setMessage('Base local resetada. Recarregue a página para atualizar todos os módulos.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500">Preferências do sistema, backup local e manutenção dos dados.</p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          {message}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Preferências</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="text-sm text-slate-600">
            Moeda
            <select value={settings.currency} onChange={(event) => updateSetting('currency', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900">
              <option value="BRL">Real brasileiro (BRL)</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Alerta de contrato
            <select value={settings.contractAlertDays} onChange={(event) => updateSetting('contractAlertDays', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900">
              <option value="30">30 dias antes</option>
              <option value="60">60 dias antes</option>
              <option value="30,60">30 e 60 dias antes</option>
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input type="checkbox" checked={settings.whatsappReminders} onChange={(event) => updateSetting('whatsappReminders', event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-emerald-600" />
            Lembretes via WhatsApp
          </label>
        </div>
        <button type="button" onClick={saveSettings} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
          <Save className="h-4 w-4" /> Salvar preferências
        </button>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Dados locais</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={exportBackup} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            <Download className="h-4 w-4" /> Exportar backup
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            <Upload className="h-4 w-4" /> Importar backup
          </button>
          <button type="button" onClick={resetData} className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50">
            <RotateCcw className="h-4 w-4" /> Resetar base local
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={importBackup} className="hidden" />
        </div>
      </section>
    </div>
  );
}
