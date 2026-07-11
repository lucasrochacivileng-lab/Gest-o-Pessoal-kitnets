import { repository } from '../repository/index.js';

// Correção pontual (equivalente ao SQL supabase/fixes/2026-07-11_...): preenche
// a forma de pagamento das despesas que hoje caem no card "Outros" por estarem
// sem payment_method reconhecível. Roda no app com o login do usuário, então
// não depende de acesso direto ao banco.

const normalize = (value = '') => {
  const text = String(value || '').toLowerCase();
  if (text.includes('boleto')) return 'boleto';
  if (text.includes('pix')) return 'pix';
  return 'outros';
};

// Regras acordadas com o Lucas (2026-07-11):
//   * PIX    = fornecedores da obra das kitnets: esquadrias, móveis.
//   * BOLETO = contas de consumo: água, energia/luz, internet.
//   * Energia SOLAR fica de fora (é paga no cartão pessoal, não é despesa
//     direta). Casa por descrição E categoria para pegar o máximo.
// Retorna 'boleto' | 'pix' | null (null = não classificar, deixa como está).
export const classifyExpensePaymentMethod = (row = {}) => {
  const text = `${row.description || ''} ${row.category || ''}`.toLowerCase();
  if (/esquadria|m[oó]vel|m[oó]veis/.test(text)) return 'pix';
  if (/solar/.test(text)) return null;
  if (/[aá]gua|energia|luz|internet/.test(text)) return 'boleto';
  return null;
};

// Só mexe nas despesas que ainda estão em "Outros" (idempotente: rodar de novo
// não altera o que já é Boleto/Pix). Retorna a contagem do que foi alterado.
export const applyPaymentMethodFix = async () => {
  const expenses = await repository.list('Expense');
  const pending = expenses.filter((row) => normalize(row.payment_method) === 'outros');
  const result = { scanned: pending.length, boleto: 0, pix: 0, skipped: 0, updated: 0 };

  for (const row of pending) {
    const method = classifyExpensePaymentMethod(row);
    if (!method) {
      result.skipped += 1;
      continue;
    }

    await repository.update('Expense', row.id, { payment_method: method });
    result[method] += 1;
  }

  result.updated = result.boleto + result.pix;
  return result;
};

export default applyPaymentMethodFix;
