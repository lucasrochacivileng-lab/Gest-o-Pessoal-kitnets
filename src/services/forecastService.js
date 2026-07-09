const toMoney = (value) => Number(value || 0);
const monthOf = (date) => String(date || '').slice(0, 7);

// Data prevista dentro do mês alvo, reaproveitando o dia de um lançamento base.
const dayInMonth = (month, baseDate, fallbackDay = 5) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const day = Number(String(baseDate || '').slice(8, 10)) || fallbackDay;
  return `${month}-${String(Math.min(Math.max(day, 1), daysInMonth)).padStart(2, '0')}`;
};

// Última ocorrência de cada item recorrente (por descrição) — vira o "modelo" mensal.
const latestRecurring = (rows, getLabel) => {
  const map = new Map();

  rows.filter((row) => row.recurring === true).forEach((row) => {
    const key = String(getLabel(row) || '').trim().toLowerCase();
    if (!key) return;
    const current = map.get(key);
    if (!current || String(row.date || '').localeCompare(String(current.date || '')) > 0) {
      map.set(key, row);
    }
  });

  return [...map.values()];
};

// Previsão de um mês ('YYYY-MM'): tudo o que se espera que ENTRE e SAIA,
// independente de já ter sido lançado.
// Regra de rolagem: recebimentos previstos que atrasaram aparecem no mês ATUAL
// (não somem no passado) até serem confirmados.
export const buildForecast = ({
  month,
  currentMonth,
  contracts = [],
  receivables = [],
  kitnets = [],
  expenses = [],
  personal = [],
  projects = [],
  expertReports = [],
}) => {
  const incomes = [];
  const outgoings = [];

  // 1. Aluguéis: contrato ativo vigente no mês. Usa o recebível se já lançado.
  contracts
    .filter((contract) => !contract.status || contract.status === 'ativo')
    .forEach((contract) => {
      const start = monthOf(contract.start_date);
      const end = monthOf(contract.end_date);
      if ((start && month < start) || (end && month > end)) return;

      const kitnet = kitnets.find((item) => item.id === contract.kitnet_id);
      const label = `Aluguel ${kitnet?.name || contract.id}`;
      const receivable = receivables.find((row) => row.contract_id === contract.id && row.competence === month && row.status !== 'cancelado');

      const contractDueDate = dayInMonth(month, `0000-00-${String(contract.due_day || 10).padStart(2, '0')}`, 10);

      if (!receivable) {
        incomes.push({ label, value: toMoney(contract.rent_value), source: 'contrato (carnê a lançar)', date: contractDueDate });
      } else if (receivable.status === 'pago') {
        incomes.push({ label, value: toMoney(receivable.paid_value ?? receivable.expected_value), source: 'já recebido', received: true, date: receivable.due_date || contractDueDate });
      } else {
        incomes.push({ label, value: Math.max(toMoney(receivable.expected_value) - toMoney(receivable.paid_value), 0), source: 'aluguel lançado', date: receivable.due_date || contractDueDate });
      }
    });

  // 2. Projetos e perícias com previsão de recebimento (com rolagem de atrasados).
  const projectRows = [
    ...projects.map((row) => ({ ...row, forecastValue: toMoney(row.value), forecastLabel: `Projeto ${row.client || row.project_type || row.id}` })),
    ...expertReports.map((row) => ({ ...row, forecastValue: toMoney(row.fee_value), forecastLabel: `Perícia ${row.client || row.process_number || row.id}` })),
  ];

  projectRows
    .filter((row) => row.status !== 'recebido' && row.expected_payment_date)
    .forEach((row) => {
      const expectedMonth = monthOf(row.expected_payment_date);
      const rolledOver = currentMonth && expectedMonth < currentMonth && month === currentMonth;
      if (expectedMonth !== month && !rolledOver) return;

      incomes.push({
        label: row.forecastLabel,
        value: row.forecastValue,
        source: rolledOver ? 'atrasado — rolado para este mês' : 'previsto',
        date: row.expected_payment_date,
      });
    });

  // 3. Finanças pessoais: recorrentes (parcelas, salário, orçamento médio) + lançamentos do mês.
  const cardTransactions = personal.filter((row) => row.type === 'card_transaction' && row.status !== 'ignorar');
  const recurringCardTransactions = latestRecurring(cardTransactions, (row) => `${row.card_name || ''}-${row.description || row.category}`);

  recurringCardTransactions.forEach((row) => {
    if (monthOf(row.date) > month) return;
    outgoings.push({
      label: `${row.card_name || 'Cartão'} - ${row.description || row.category} (recorrente)`,
      value: toMoney(row.value),
      source: row.status === 'revisar' ? 'cartão importado - revisar' : 'cartão',
      date: dayInMonth(month, row.date),
    });
  });

  cardTransactions
    .filter((row) => row.recurring !== true && monthOf(row.date) === month)
    .forEach((row) => {
      outgoings.push({
        label: `${row.card_name || 'Cartão'} - ${row.description || row.category}${row.installment ? ` (${row.installment})` : ''}`,
        value: toMoney(row.value),
        source: row.status === 'revisar' ? 'cartão importado - revisar' : 'cartão',
        date: row.date,
      });
    });

  const personalActive = personal.filter((row) => row.status !== 'ignorar' && row.type !== 'card_transaction');
  const personalRecurring = latestRecurring(personalActive, (row) => row.description || row.category);

  personalRecurring.forEach((row) => {
    if (monthOf(row.date) > month) return;
    const entry = { label: `${row.description || row.category} (recorrente)`, value: toMoney(row.value), source: 'pessoal', date: dayInMonth(month, row.date) };
    if (row.type === 'income') incomes.push(entry);
    else outgoings.push(entry);
  });

  personalActive
    .filter((row) => row.recurring !== true && monthOf(row.date) === month)
    .forEach((row) => {
      const entry = { label: row.description || row.category, value: toMoney(row.value), source: 'pessoal', date: row.date };
      if (row.type === 'income') incomes.push(entry);
      else outgoings.push(entry);
    });

  // 4. Despesas das kitnets: recorrentes (água, parcelas) + lançadas no mês.
  const expenseRecurring = latestRecurring(expenses, (row) => row.description || row.category);

  expenseRecurring.forEach((row) => {
    if (monthOf(row.date) > month) return;
    outgoings.push({ label: `${row.description || row.category} (recorrente)`, value: toMoney(row.value), source: 'kitnets', date: dayInMonth(month, row.date) });
  });

  expenses
    .filter((row) => row.recurring !== true && monthOf(row.date) === month)
    .forEach((row) => {
      outgoings.push({ label: row.description || row.category, value: toMoney(row.value), source: 'kitnets', date: row.date });
    });

  // Tabela em ordem cronológica: o mês vira uma linha do tempo de entradas e saídas.
  const byDate = (a, b) => String(a.date || '').localeCompare(String(b.date || ''));
  incomes.sort(byDate);
  outgoings.sort(byDate);

  const totalIn = incomes.reduce((sum, row) => sum + row.value, 0);
  const totalOut = outgoings.reduce((sum, row) => sum + row.value, 0);

  return {
    incomes,
    outgoings,
    totalIn,
    totalOut,
    balance: totalIn - totalOut,
  };
};

export default buildForecast;
