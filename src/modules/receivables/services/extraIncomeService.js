const toMoney = (value) => Number(value || 0);
const monthOf = (date) => String(date || '').slice(0, 7);

const incomeDate = (row = {}) => (
  row.received_at
  || row.received_date
  || row.expected_payment_date
  || row.due_date
  || ''
);

const normalizeStatus = (status = '') => (
  status === 'recebido' ? 'recebido' : 'previsto'
);

const projectLabel = (row = {}) => [
  row.client,
  row.project_type,
].filter(Boolean).join(' - ') || row.id;

const expertReportLabel = (row = {}) => [
  row.client,
  row.report_type || row.process_number,
].filter(Boolean).join(' - ') || row.id;

export const buildExtraIncomeRows = ({ projects = [], expertReports = [], month }) => {
  const projectRows = projects.map((row) => ({
    id: `project-${row.id}`,
    entity: 'ComplementaryProject',
    sourceId: row.id,
    kind: 'Projeto',
    label: projectLabel(row),
    date: incomeDate(row),
    value: toMoney(row.value),
    status: normalizeStatus(row.status),
  }));

  const expertRows = expertReports.map((row) => ({
    id: `expert-${row.id}`,
    entity: 'ExpertReport',
    sourceId: row.id,
    kind: 'Pericia',
    label: expertReportLabel(row),
    date: incomeDate(row),
    value: toMoney(row.fee_value),
    status: normalizeStatus(row.status),
  }));

  return [...projectRows, ...expertRows]
    .filter((row) => row.date && monthOf(row.date) === month)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
};

export const buildExtraIncomeSummary = (rows = []) => ({
  total: rows.reduce((sum, row) => sum + row.value, 0),
  received: rows.filter((row) => row.status === 'recebido').reduce((sum, row) => sum + row.value, 0),
  pending: rows.filter((row) => row.status !== 'recebido').reduce((sum, row) => sum + row.value, 0),
  count: rows.length,
});

export default buildExtraIncomeRows;
