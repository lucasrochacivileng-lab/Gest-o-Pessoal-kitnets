import { MonthChips } from '../ui/MonthChips.jsx';
import { SEGMENTS } from '../../services/financialClassification.js';
export default function ReportFilters({ month, segment, setMonth, setSegment }) {
  return <div className="space-y-3">
    <MonthChips value={month} onChange={setMonth} />
    <label className="block text-sm font-medium text-slate-700">Segmento
      <select className="ds-input mt-1 max-w-sm" value={segment} onChange={(e) => setSegment(e.target.value)}>
        <option value="">Todos os segmentos</option>
        {SEGMENTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
    </label>
  </div>;
}
