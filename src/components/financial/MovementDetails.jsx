import { Link } from 'react-router-dom';
import { financialService } from '../../services/financialService';
import { formatDateBR } from '../../services/dateUtils.js';
import { categoryLabel, normalizeCategory } from '../../services/categoryReportService.js';
export default function MovementDetails({ items, month, segment = '' }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm">
    <caption className="py-3 text-left text-slate-500">{items.length} lançamento(s) neste recorte. Abra a origem para conferir ou editar.</caption>
    <thead><tr className="border-b"><th className="p-2">Data</th><th className="p-2">Descrição / origem</th><th className="p-2">Categoria</th><th className="p-2">Tipo</th><th className="p-2 text-right">Valor</th></tr></thead>
    <tbody>{items.map((item, i) => <tr className="border-b border-slate-100" key={`${item.id}-${i}`}>
      <td className="p-2 whitespace-nowrap">{formatDateBR(item.date)}</td>
      <td className="p-2"><Link className="font-medium text-blue-700 underline" to={`${item.href}?month=${month}&segment=${segment}&record=${encodeURIComponent(item.sourceId || '')}`}>{item.description}</Link><div className="text-xs text-slate-500">{item.source}{item.legacySegment ? ' · segmento herdado' : ''}</div></td>
      <td className="p-2">{categoryLabel(normalizeCategory(item))}</td><td className="p-2">{item.kind === 'entrada' ? 'Entrada' : 'Saída'}</td>
      <td className={`p-2 text-right whitespace-nowrap ${item.kind === 'entrada' ? 'text-emerald-700' : 'text-red-700'}`}>{financialService.formatCurrency(item.value)}</td>
    </tr>)}</tbody>
  </table>{!items.length && <p className="p-4 text-slate-500">Nenhum lançamento neste recorte.</p>}</div>;
}
