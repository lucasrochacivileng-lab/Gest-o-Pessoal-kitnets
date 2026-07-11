import { repository } from '../repository/index.js';

// Espelho do recurringExpenseService, mas para RENDAS pessoais recorrentes
// (ex.: salário de servidor que entra todo mês). Duas diferenças de propósito:
// 1. A data cai no ÚLTIMO DIA ÚTIL do mês (salário do funcionalismo), não num
//    dia fixo.
// 2. Nasce como "previsto": a recorrência é uma projeção; o valor real (que
//    varia, ex.: 8.99x em vez de 9.000) é confirmado depois virando "recebido"
//    — só o confirmado entra no caixa (ver cashflowService).

// Inclui o contexto na chave para separar salário ('trabalho') de outras
// rendas recorrentes de mesmo nome em contextos diferentes.
const templateKey = (row) => {
  const description = String(row.description || row.category || '').trim().toLowerCase();
  const context = String(row.context || '').trim().toLowerCase();
  return description ? `${context || 'sem-contexto'}|${description}` : '';
};

// Último dia útil (seg–sex) da competência 'YYYY-MM': parte do último dia do
// mês e recua enquanto cair em sábado (6) ou domingo (0).
export const lastBusinessDayOf = (competence) => {
  const [year, month] = competence.split('-').map(Number);
  const date = new Date(year, month, 0);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  }
  return date.getDate();
};

// Regra pura: dado o mês ('YYYY-MM'), monta as rendas recorrentes que faltam.
// Para cada renda marcada como "recorrente", usa o lançamento mais recente como
// modelo e replica no mês alvo, sem duplicar se já houver renda igual no mês.
export const buildRecurringIncomes = (incomes = [], competence) => {
  const templates = new Map();

  incomes
    .filter((row) => row.type === 'income' && row.recurring === true && templateKey(row))
    .forEach((row) => {
      const key = templateKey(row);
      const current = templates.get(key);
      if (!current || String(row.date || '').localeCompare(String(current.date || '')) > 0) {
        templates.set(key, row);
      }
    });

  const alreadyInMonth = new Set(
    incomes
      .filter((row) => row.type === 'income' && String(row.date || '').startsWith(competence))
      .map(templateKey)
      .filter(Boolean),
  );

  return [...templates.values()]
    .filter((template) => !alreadyInMonth.has(templateKey(template)))
    .map((template) => {
      const day = lastBusinessDayOf(competence);

      return {
        date: `${competence}-${String(day).padStart(2, '0')}`,
        type: 'income',
        description: template.description || '',
        value: Number(template.value || 0),
        context: template.context || 'pessoal',
        category: template.category || 'salario',
        card_name: template.card_name || '',
        installment: '',
        status: 'previsto',
        recurring: true,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
};

export const recurringIncomeService = {
  async generateForCompetence(competence) {
    const incomes = await repository.list('PersonalIncome');
    const toCreate = buildRecurringIncomes(incomes, competence);

    for (const payload of toCreate) {
      await repository.create('PersonalIncome', payload);
    }

    return { created: toCreate.length };
  },
};

export default recurringIncomeService;
