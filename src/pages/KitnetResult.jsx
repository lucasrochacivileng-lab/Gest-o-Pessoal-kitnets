import React, { useEffect, useMemo, useState } from 'react';
import { repository } from '../repository/index.js';
import { useEntitySync } from '../hooks/useEntitySync.js';
import { MonthChips } from '../components/ui/MonthChips.jsx';
import { financialService } from '../services/financialService';
import { buildKitnetResults } from '../services/kitnetResultService.js';

const money = (value) => financialService.formatCurrency(value);
const resultTone = (value) => (value < 0 ? 'text-red-600' : 'text-slate-900');

export default function KitnetResult() {
  const [competence, setCompetence] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);

  const load = async () => {
    const [kitnets, payments, expenses, personal] = await Promise.all([
      repository.list('Kitnet'),
      repository.list('Payment'),
      repository.list('Expense'),
      repository.list('PersonalIncome'),
    ]);
    setData({ kitnets, payments, expenses, personal });
  };

  useEffect(() => {
    load();
  }, []);

  useEntitySync(['Kitnet', 'Payment', 'Expense', 'PersonalIncome'], load);

  const result = useMemo(
    () => (data ? buildKitnetResults({ ...data, monthKey: competence }) : null),
    [data, competence],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Resultado por kitnet</h1>
        <p className="text-sm text-slate-500">
          Aluguel recebido de cada unidade menos as despesas vinculadas a ela. Custos "Geral" (que cobrem todas as
          unidades) aparecem à parte e ainda não são rateados. Regime de caixa: só entra o que foi pago/recebido.
        </p>
      </div>

      <MonthChips value={competence} onChange={setCompetence} />

      {!result ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500">Carregando resultado...</div>
      ) : (
        <>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Resultado das kitnets no mês</p>
            <p className={`mt-2 text-2xl font-semibold tabular-nums ${resultTone(result.totals.result)}`}>
              {money(result.totals.result)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {money(result.totals.income)} de aluguéis − {money(result.totals.expense)} de despesas
              {result.geral.expense > 0 ? ` (inclui ${money(result.geral.expense)} em custos Gerais)` : ''}
            </p>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kitnet</th>
                  <th className="px-4 py-3 text-right">Aluguel</th>
                  <th className="px-4 py-3 text-right">Despesas</th>
                  <th className="px-4 py-3 text-right">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {result.kitnets.map((kitnet) => (
                  <tr key={kitnet.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-900">{kitnet.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{money(kitnet.income)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">{money(kitnet.expense)}</td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${resultTone(kitnet.result)}`}>
                      {money(kitnet.result)}
                    </td>
                  </tr>
                ))}
                {result.geral.expense > 0 ? (
                  <tr className="border-t border-slate-100 bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-600">Geral (não rateado)</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">—</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">{money(result.geral.expense)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-red-600">
                      {money(-result.geral.expense)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 font-semibold">
                  <td className="px-4 py-3 text-slate-900">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{money(result.totals.income)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600">{money(result.totals.expense)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${resultTone(result.totals.result)}`}>
                    {money(result.totals.result)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {result.kitnets.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Nenhuma kitnet cadastrada ainda.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
