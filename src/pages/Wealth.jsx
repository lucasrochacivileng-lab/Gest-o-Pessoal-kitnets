import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { repository } from '../repository/index.js';
import { supabase, isSupabaseEnabled } from '../services/supabaseClient.js';
import { useEntitySync } from '../hooks/useEntitySync.js';
import { useReportFilters } from '../hooks/useReportFilters.js';
import { MonthChips } from '../components/ui/MonthChips.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import { wealthService, WEALTH_KINDS, buildWealthHistory } from '../services/wealthService.js';
import { todayLocalISO, formatDateBR } from '../services/dateUtils.js';
import { financialService } from '../services/financialService';

const money = (v) => v == null ? 'Não apurado' : financialService.formatCurrency(v);
const initialAsset = () => ({ name: '', kind: 'imovel', start_date: todayLocalISO(), notes: '' });
const initialPosition = () => ({ asset_id: '', date: todayLocalISO(), value: '', ownership_percent: 100, source: '', reason: '' });
export default function Wealth() {
  const { month, setMonth } = useReportFilters();
  const [data, setData] = useState(null);
  const [allowed, setAllowed] = useState(!isSupabaseEnabled);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [asset, setAsset] = useState(initialAsset);
  const [position, setPosition] = useState(initialPosition);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const version = ++request.current;
    try {
      if (isSupabaseEnabled) {
        const access = await supabase.rpc('wealth_access');
        if (access.error) throw new Error('Patrimônio indisponível. Confira a conexão e a aplicação da migração de patrimônio no Supabase.');
        if (!access.data) { setAllowed(false); setData({ assets: [], valuations: [] }); return; }
      }
      const [assets, valuations] = await Promise.all([repository.list('WealthAsset'), repository.list('WealthValuation')]);
      if (version !== request.current) return;
      setAllowed(true); setData({ assets, valuations }); setError('');
    } catch (e) { if (version === request.current) setError(e.message); }
  }, []);
  useEffect(() => { reload(); return () => { request.current += 1; }; }, [reload]);
  useEntitySync(['WealthAsset', 'WealthValuation'], reload);
  const history = useMemo(() => data ? buildWealthHistory(data.assets, data.valuations, month) : [], [data, month]);
  const snapshot = history.at(-1);
  const submit = async (event, type) => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      if (type === 'asset') {
        const saved = await wealthService.createAsset(asset); setAsset(initialAsset());
        setPosition({ ...initialPosition(), asset_id: saved.id }); setMessage('Cadastro salvo. Registre a primeira posição para apurar seu valor.');
      } else {
        await wealthService.recordValuation(position, data.assets.find((a) => a.id === position.asset_id));
        setPosition(initialPosition()); setMessage('Posição registrada. O histórico anterior foi preservado.');
      }
      await reload();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  return <div className="space-y-6">
    <PageHeader title="Patrimônio" description="Bens, investimentos e dívidas com posições datadas. Acesso administrativo." />
    {error && <p role="alert" className="ds-alert ds-alert-warning">{error} <button onClick={reload} className="underline">Atualizar</button></p>}
    {message && <p role="status" className="ds-alert ds-alert-info">{message}</p>}
    {!data ? <p>Carregando patrimônio...</p> : !allowed ? <p className="ds-card">Somente administradores podem consultar ou registrar patrimônio.</p> : <>
      <MonthChips value={month} onChange={setMonth} />
      <p className="text-sm text-slate-600">Posição até {formatDateBR(snapshot.date)}. Inclui apenas bens e dívidas cadastrados e sua participação informada. Contas, imóveis e investimentos não são importados automaticamente: cadastre cada saldo uma única vez.</p>
      <div className="grid gap-4 md:grid-cols-3">{[['Ativos avaliados', snapshot.totalAssets], ['Dívidas informadas', snapshot.debts], ['Patrimônio líquido estimado', snapshot.net]].map(([label, value]) => <div key={label} className="ds-card"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{money(value)}</p></div>)}</div>
      {!!snapshot.missing.length && <p className="ds-alert ds-alert-warning">Falta posição para {snapshot.missing.map((r) => r.name).join(', ')}. O patrimônio líquido não será apurado até completar os valores.</p>}
      {!data.assets.length && <p className="ds-card">Comece cadastrando seus bens, contas, investimentos e dívidas. Sem posições, não existe histórico suficiente para calcular patrimônio.</p>}
      <section className="ds-card"><h2 className="font-semibold">Evolução do patrimônio registrado</h2><p className="mt-1 text-xs text-slate-500">Cada mês usa a última posição conhecida até aquela data. Sem avaliação, o gráfico fica interrompido; valores antigos são mantidos como estimativa, não como nova avaliação.</p><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={history}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" fontSize={11} /><YAxis width={75} fontSize={11} /><Tooltip formatter={money} /><Legend /><Line name="Patrimônio líquido" dataKey="net" stroke="#2563eb" strokeWidth={3} connectNulls={false} /></LineChart></ResponsiveContainer></div></section>
      <section className="ds-card overflow-x-auto"><h2 className="font-semibold">Composição na data selecionada</h2><table className="mt-3 w-full text-left text-sm"><thead><tr><th className="p-2">Bem ou dívida</th><th className="p-2">Tipo</th><th className="p-2">Avaliação</th><th className="p-2">Participação</th><th className="p-2 text-right">Seu valor</th></tr></thead><tbody>{snapshot.rows.map((r) => <tr className="border-t" key={r.id}><td className="p-2"><button className="text-blue-700 underline" onClick={() => { setPosition({ ...initialPosition(), asset_id: r.id }); document.getElementById('wealth-position')?.scrollIntoView({ behavior: 'smooth' }); }}>{r.name}</button></td><td className="p-2">{WEALTH_KINDS[r.kind]}</td><td className="p-2">{r.valuation ? formatDateBR(r.valuation.date) : 'Sem posição'}{r.carried ? ' · valor anterior' : ''}</td><td className="p-2">{r.valuation ? `${r.valuation.ownership_percent}%` : '—'}</td><td className="p-2 text-right">{money(r.value)}</td></tr>)}</tbody></table></section>
      <div className="grid gap-6 lg:grid-cols-2">
        <form className="ds-card space-y-3" onSubmit={(e) => submit(e, 'asset')}><h2 className="font-semibold">Cadastrar bem ou dívida</h2>
          <label className="block text-sm">Nome<input required className="ds-input mt-1" value={asset.name} onChange={(e) => setAsset({ ...asset, name: e.target.value })} placeholder="Ex.: Kitnet 01, CDB, financiamento" /></label>
          <label className="block text-sm">Tipo<select className="ds-input mt-1" value={asset.kind} onChange={(e) => setAsset({ ...asset, kind: e.target.value })}>{Object.entries(WEALTH_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="block text-sm">Aquisição ou início da dívida<input required type="date" max={todayLocalISO()} className="ds-input mt-1" value={asset.start_date} onChange={(e) => setAsset({ ...asset, start_date: e.target.value })} /></label>
          <label className="block text-sm">Observações<input className="ds-input mt-1" value={asset.notes} onChange={(e) => setAsset({ ...asset, notes: e.target.value })} /></label>
          <button disabled={saving} className="ds-btn ds-btn-primary">{saving ? 'Salvando...' : 'Cadastrar'}</button>
        </form>
        <form id="wealth-position" className="ds-card space-y-3 scroll-mt-6" onSubmit={(e) => submit(e, 'position')}><h2 className="font-semibold">Registrar posição / avaliação</h2>
          <label className="block text-sm">Bem ou dívida<select required className="ds-input mt-1" value={position.asset_id} onChange={(e) => setPosition({ ...position, asset_id: e.target.value })}><option value="">Selecione</option>{data.assets.map((a) => <option value={a.id} key={a.id}>{a.name} · {WEALTH_KINDS[a.kind]}</option>)}</select></label>
          <label className="block text-sm">Data da posição<input required type="date" max={todayLocalISO()} className="ds-input mt-1" value={position.date} onChange={(e) => setPosition({ ...position, date: e.target.value })} /></label>
          <label className="block text-sm">Valor total do bem ou saldo devedor (R$)<input required type="number" min="0" step="0.01" className="ds-input mt-1" value={position.value} onChange={(e) => setPosition({ ...position, value: e.target.value })} /></label>
          <label className="block text-sm">Sua participação ou responsabilidade (%)<input required type="number" min="0.01" max="100" step="0.01" className="ds-input mt-1" value={position.ownership_percent} onChange={(e) => setPosition({ ...position, ownership_percent: e.target.value })} /></label>
          <label className="block text-sm">Fonte da informação<input required className="ds-input mt-1" placeholder="Extrato, avaliação, estimativa própria" value={position.source} onChange={(e) => setPosition({ ...position, source: e.target.value })} /></label>
          <label className="block text-sm">Motivo / observação<input required className="ds-input mt-1" placeholder="Posição mensal, reavaliação, amortização, correção" value={position.reason} onChange={(e) => setPosition({ ...position, reason: e.target.value })} /></label>
          <p className="text-xs text-slate-500">Para corrigir, registre outra posição na mesma data; a mais recente prevalece e a anterior fica no histórico. Ao vender um bem ou quitar uma dívida, registre valor zero. Isto não lança receita nem despesa.</p>
          <button disabled={saving || !data.assets.length} className="ds-btn ds-btn-primary">{saving ? 'Salvando...' : 'Registrar posição'}</button>
        </form>
      </div>
      <details className="ds-card"><summary className="cursor-pointer font-semibold">Histórico de posições registradas</summary><div className="overflow-x-auto"><table className="mt-4 w-full text-left text-sm"><thead><tr><th>Data</th><th>Bem/dívida</th><th>Valor total</th><th>Participação</th><th>Fonte e motivo</th></tr></thead><tbody>{[...data.valuations].sort((a, b) => b.date.localeCompare(a.date) || String(b.recorded_at || '').localeCompare(String(a.recorded_at || ''))).map((v) => <tr key={v.id} className="border-t"><td className="py-3">{formatDateBR(v.date)}</td><td>{data.assets.find((a) => a.id === v.asset_id)?.name || 'Cadastro não encontrado'}</td><td>{money(v.value)}</td><td>{v.ownership_percent}%</td><td>{v.source} · {v.reason}</td></tr>)}</tbody></table></div></details>
      <details className="ds-card"><summary className="cursor-pointer font-semibold">Valores do gráfico</summary><div className="mt-3 space-y-2">{history.map((r) => <p key={r.month}>{r.label}: {money(r.net)}{r.rows.some((a) => a.carried) ? ' · contém posições de meses anteriores' : ''}</p>)}</div></details>
    </>}
  </div>;
}
