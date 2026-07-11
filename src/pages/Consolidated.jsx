import React, { useEffect, useMemo, useState } from 'react';
import { repository } from '../repository/index.js';
import { useEntitySync } from '../hooks/useEntitySync.js';
import { MonthChips } from '../components/ui/MonthChips.jsx';
import { financialService } from '../services/financialService';
import { buildSegmentConsolidation } from '../services/segmentConsolidationService.js';

const money = (value) => financialService.formatCurrency(value);

const SEGMENT_TONES = {
  kitnets: 'bg-emerald-50 text-emerald-700',
  projetos: 'bg-blue-50 text-blue-700',
  pericias: 'bg-violet-50 text-violet-700',
  trabalho: 'bg-amber-50 text-amber-700',
  pessoal: 'bg-slate-100 text-slate-700',
};

function ResultValue({ value }) {
  const tone = value < 0 ? 'text-red-600' : 'text-slate-900';
  return <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{money(value)}</p>;
}

export default function Consolidated() {
  const [competence, setCompetence] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);

  const load = async () => {
    const [payments, expenses, personal, projects, expertReports] = await Promise.all([
      repository.list('Payment'),
      repository.list('Expense'),
      repository.list('PersonalIncome'),
      repository.list('ComplementaryProject'),
      repository.list('ExpertReport'),
    ]);
    setData({ payments, expenses, personal, projects, expertReports });
  };

  useEffect(() => {
    load();
  }, []);

  useEntitySync(['Payment', 'Expense', 'PersonalIncome', 'ComplementaryProject', 'ExpertReport'], load);

  const consolidation = useMemo(
    () => (data ? buildSegmentConsolidation({ ...data, monthKey: competence }) : null),
    [data, competence],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Consolidado por segmento</h1>
        <p className="text-sm text-slate-500">
          Resultado de cada frente — kitnets, projetos, perícias, trabalho e pessoal — com entradas e saídas separadas,
          mais o total global. Regime de caixa: só entra o que foi efetivamente pago/recebido.
        </p>
      </div>

      <MonthChips value={competence} onChange={setCompetence} />

      {!consolidation ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500">Carregando consolidado...</div>
      ) : (
        <>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Resultado global do mês</p>
            <ResultValue value={consolidation.global.result} />
            <p className="mt-1 text-sm text-slate-500">
              {money(consolidation.global.income)} em entradas − {money(consolidation.global.expense)} em saídas
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {consolidation.segments.map((segment) => (
              <div key={segment.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{segment.label}</p>
                  <span className={`ds-badge ${SEGMENT_TONES[segment.key] || 'bg-slate-100 text-slate-700'}`}>
                    {segment.result < 0 ? 'negativo' : 'resultado'}
                  </span>
                </div>
                <ResultValue value={segment.result} />
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Entradas</p>
                    <p className="font-semibold text-emerald-700 tabular-nums">{money(segment.income)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Saídas</p>
                    <p className="font-semibold text-red-600 tabular-nums">{money(segment.expense)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-600">Como cada segmento é montado</p>
            <ul className="mt-2 space-y-1">
              <li><strong>Kitnets</strong>: aluguéis recebidos − despesas diretas pagas (e gastos pessoais marcados como kitnets/obra).</li>
              <li><strong>Projetos / Perícias</strong>: valor efetivamente recebido no mês (status "Recebido").</li>
              <li><strong>Trabalho</strong>: renda pessoal com contexto "Trabalho/Servidor" já confirmada (salário previsto ainda não conta).</li>
              <li><strong>Pessoal</strong>: demais rendas e despesas pessoais confirmadas.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
