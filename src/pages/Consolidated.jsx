import { useReportFilters } from '../hooks/useReportFilters.js';
import { useFinancialData } from '../hooks/useFinancialData.js';
import MovementDetails from '../components/financial/MovementDetails.jsx';
import React, { useMemo } from 'react';
import { MonthChips } from '../components/ui/MonthChips.jsx';
import { financialService } from '../services/financialService';
import { buildSegmentConsolidation } from '../services/segmentConsolidationService.js';
import PageHeader from '../components/ui/PageHeader.jsx';

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
  const { month: competence, setMonth: setCompetence, segment: selectedSegment, setSegment: setSelectedSegment } = useReportFilters();
  const { data, error, reload } = useFinancialData();




  const consolidation = useMemo(
    () => (data ? buildSegmentConsolidation({ ...data, monthKey: competence }) : null),
    [data, competence],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Consolidado por segmento" description={(
        <>
          Resultado de cada frente — kitnets, projetos, perícias, trabalho e pessoal — com entradas e saídas separadas,
          mais o total global. Lançamentos confirmados, sem duplicar transferências ou quitação de faturas.
        </>
      )} />

      <MonthChips value={competence} onChange={setCompetence} />
      {error && <p role="alert">{error} <button onClick={reload}>Tentar novamente</button></p>}

      {!consolidation ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">Carregando consolidado...</div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-normal text-slate-500">Resultado global do mês</p>
            <ResultValue value={consolidation.global.result} />
            <p className="mt-1 text-sm text-slate-500">
              {money(consolidation.global.income)} em entradas − {money(consolidation.global.expense)} em saídas
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {consolidation.segments.map((segment) => {
              const active = selectedSegment === segment.key;
              return (
                <button
                  key={segment.key}
                  type="button"
                  onClick={() => setSelectedSegment(active ? '' : segment.key)}
                  className={`rounded-xl border p-5 text-left shadow-sm transition ${
                    active ? 'border-blue-500 ring-1 ring-blue-200' : 'border-slate-200 hover:bg-slate-50'
                  } bg-white`}
                >
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
                  <p className="mt-2 text-xs text-slate-400">
                    {segment.items.length} lançamento(s) · {active ? 'clique para fechar' : 'clique para detalhar'}
                  </p>
                </button>
              );
            })}
          </div>

          {selectedSegment ? (() => {
            const segment = consolidation.segments.find((item) => item.key === selectedSegment);
            if (!segment) return null;

            return (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Detalhe — {segment.label}</p>
                  <button type="button" onClick={() => setSelectedSegment('')} className="text-xs text-slate-500 hover:text-slate-700">
                    fechar
                  </button>
                </div>

                <MovementDetails items={segment.items} month={competence} segment={selectedSegment} />
              </div>
            );
          })() : null}

          <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-600">Como cada segmento é montado</p>
            <ul className="mt-2 space-y-1">
              <li><strong>Kitnets</strong>: aluguéis recebidos − despesas diretas pagas (e gastos pessoais marcados como kitnets/obra).</li>
              <li><strong>Projetos / Perícias</strong>: recebimentos confirmados menos gastos atribuídos ao segmento.</li>
              <li><strong>Trabalho</strong>: renda pessoal com contexto "Trabalho/Servidor" já confirmada (salário previsto ainda não conta).</li>
              <li><strong>Pessoal</strong>: demais rendas e despesas pessoais confirmadas.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
