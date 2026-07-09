import { repository } from '../repository/index.js';

// Inclui a kitnet na chave: duas kitnets com uma despesa recorrente de
// mesmo nome (ex.: "Água" na Kitnet 01 e "Água" na Kitnet 02) são
// lançamentos INDEPENDENTES. Sem a kitnet na chave, a segunda "engolia"
// a primeira — só uma das duas voltava a ser gerada todo mês, e o
// "já lançado no mês" de uma dava falso positivo pra outra.
const templateKey = (row) => {
  const description = String(row.description || row.category || '').trim().toLowerCase();
  return description ? `${row.kitnet_id || 'sem-kitnet'}|${description}` : '';
};

const clampDay = (competence, day) => {
  const [year, month] = competence.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.min(Math.max(Number(day) || 5, 1), daysInMonth);
};

// Regra pura: dado o mês ('YYYY-MM'), monta as despesas recorrentes que faltam.
// Para cada despesa marcada como "recorrente", usa o lançamento mais recente como
// modelo e replica no mês alvo, sem duplicar se já houver lançamento igual no mês.
export const buildRecurringExpenses = (expenses = [], competence) => {
  const templates = new Map();

  expenses
    .filter((row) => row.recurring === true && templateKey(row))
    .forEach((row) => {
      const key = templateKey(row);
      const current = templates.get(key);
      if (!current || String(row.date || '').localeCompare(String(current.date || '')) > 0) {
        templates.set(key, row);
      }
    });

  const alreadyInMonth = new Set(
    expenses
      .filter((row) => String(row.date || '').startsWith(competence))
      .map(templateKey)
      .filter(Boolean),
  );

  return [...templates.values()]
    .filter((template) => !alreadyInMonth.has(templateKey(template)))
    .map((template) => {
      const day = clampDay(competence, String(template.date || '').slice(8, 10));

      return {
        date: `${competence}-${String(day).padStart(2, '0')}`,
        category: template.category || 'outro',
        type: template.type || 'fixa',
        kitnet_id: template.kitnet_id || '',
        description: template.description || '',
        value: Number(template.value || 0),
        payment_method: template.payment_method || '',
        account: template.account || '',
        status: 'pendente',
        notes: template.notes || '',
        recurring: true,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
};

export const recurringExpenseService = {
  async generateForCompetence(competence) {
    const expenses = await repository.list('Expense');
    const toCreate = buildRecurringExpenses(expenses, competence);

    for (const payload of toCreate) {
      await repository.create('Expense', payload);
    }

    return { created: toCreate.length };
  },
};

export default recurringExpenseService;
