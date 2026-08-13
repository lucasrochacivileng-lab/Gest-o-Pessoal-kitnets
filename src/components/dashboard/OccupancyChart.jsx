import { useNavigate } from 'react-router-dom';
import { financialService } from '../../services/financialService';
import { formatDateBR } from '../../services/dateUtils.js';

// Era uma rosquinha de "ocupadas x vagas". Com 10 unidades ela não dizia nada
// que os cartões logo acima ("Ocupadas 10 de 10", "Vagas 0") já não dissessem —
// e uma pizza de 2 fatias é sempre pior que o número escrito.
//
// No lugar dela, a pergunta que se faz todo dia: QUEM já pagou este mês. Uma
// linha por unidade, com a situação escrita, clicável para registrar ou
// conferir o recebimento.
const RENT_STATUS = {
  pago: { label: 'Pago', dot: 'bg-emerald-500', chip: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  vencido: { label: 'Vencido', dot: 'bg-red-500', chip: 'border-red-200 bg-red-50 text-red-900' },
  parcial: { label: 'Parcial', dot: 'bg-amber-500', chip: 'border-amber-200 bg-amber-50 text-amber-900' },
  pendente: { label: 'A vencer', dot: 'bg-slate-400', chip: 'border-slate-200 bg-white text-slate-700' },
};

const VACANT = { label: 'Vaga', dot: 'bg-orange-500', chip: 'border-orange-200 bg-orange-50 text-orange-900' };
const NO_CHARGE = { label: 'Sem cobrança no mês', dot: 'bg-slate-300', chip: 'border-slate-200 bg-slate-50 text-slate-600' };

const appearanceOf = (unit) => {
  if (unit.rentStatus) return RENT_STATUS[unit.rentStatus] || NO_CHARGE;
  return unit.occupancy === 'vaga' ? VACANT : NO_CHARGE;
};

const detailOf = (unit) => {
  if (unit.rentStatus === 'pago') return 'recebido';
  if (unit.outstanding > 0) return financialService.formatCurrency(unit.outstanding);
  if (unit.dueDate) return `vence ${formatDateBR(unit.dueDate)}`;
  return '';
};

export function OccupancyChart({ units = [], occupied = 0, vacant = 0, totalKitnets = 0 }) {
  const navigate = useNavigate();
  const others = Math.max(0, totalKitnets - occupied - vacant);
  const paid = units.filter((unit) => unit.rentStatus === 'pago').length;
  const charged = units.filter((unit) => unit.rentStatus).length;

  const open = (unit) => {
    // Sem recebível gerado não há o que registrar: leva para a unidade.
    navigate(unit.receivableId ? `/recebimentos/${unit.receivableId}` : '/kitnets');
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-slate-900">Aluguéis do mês</h3>
        <span className="text-xs text-slate-500">toque para abrir</span>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        {charged > 0 ? `${paid} de ${charged} já recebidos.` : 'Nenhuma cobrança gerada neste mês.'}
      </p>

      {units.length ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {units.map((unit) => {
            const look = appearanceOf(unit);
            const detail = detailOf(unit);
            return (
              <button
                key={unit.id}
                type="button"
                onClick={() => open(unit)}
                className={`flex min-h-11 items-center gap-2.5 rounded-[var(--radius-lg)] border px-3 py-2.5 text-left text-sm transition hover:brightness-95 ${look.chip}`}
              >
                {/* A cor nunca vai sozinha: a situação está escrita ao lado. */}
                <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${look.dot}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{unit.name || 'Kitnet'}</span>
                  <span className="block text-xs opacity-75">
                    {look.label}{detail ? ` · ${detail}` : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex h-[160px] items-center justify-center text-sm text-slate-500">
          Nenhuma kitnet cadastrada
        </div>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Ocupadas ({occupied})</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" />Vagas ({vacant})</span>
        {others > 0 ? <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />Outras ({others})</span> : null}
      </div>
    </div>
  );
}

export default OccupancyChart;
