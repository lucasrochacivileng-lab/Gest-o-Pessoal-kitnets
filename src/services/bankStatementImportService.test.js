import { describe, expect, it } from 'vitest';
import {
  buildStatementImportPlan,
  classifyStatementRow,
  excludeReversedPix,
  parseNubankStatementCsv,
} from './bankStatementImportService.js';

const SAMPLE_CSV = [
  'Data,Valor,Identificador,Descrição',
  '15/06/2026,-5625.00,id-vidrosul,Transferência enviada pelo Pix - VIDROSUL COMERCIO DE VIDROS E BOX LTDA - 04.121.502/0001-21 - CAIXA ECONOMICA FEDERAL (0104) Agência: 953 Conta: 1292000000578327066-7',
  '15/06/2026,5625.00,id-resgate,Resgate RDB',
  '09/06/2026,-831.00,id-aplicacao,Aplicação RDB',
  '10/06/2026,-5581.44,id-fatura,Pagamento de fatura',
  '10/06/2026,-129.99,id-boleto,Pagamento de boleto efetuado - SP NET INTERNET GOIATUBA',
  '08/06/2026,830.00,id-recebido,Transferência recebida pelo Pix - GEOVANA MARTINS COSTA - •••.135.701-•• - ITAÚ UNIBANCO S.A. (0341) Agência: 5453 Conta: 26456-5',
  '18/06/2026,240.00,id-recebido2,Transferência Recebida - Geovana Martins Costa - •••.135.701-•• - NU PAGAMENTOS - IP (0260) Agência: 1 Conta: 73702330-3',
  '03/07/2026,-2000.00,id-estorno,Transferência enviada pelo Pix - Ketlen Nunes Vieira - •••.090.041-•• - PICPAY (0380) Agência: 1 Conta: 121662019-9',
  '03/07/2026,2000.00,id-estorno,Estorno - Transferência enviada pelo Pix - Ketlen Nunes Vieira - •••.090.041-•• - PICPAY (0380) Agência: 1 Conta: 121662019-9',
].join('\n');

describe('parseNubankStatementCsv', () => {
  it('lê data BR -> ISO, valor numérico e identificador', () => {
    const rows = parseNubankStatementCsv(SAMPLE_CSV);

    expect(rows).toHaveLength(9);
    expect(rows[0]).toEqual({
      date: '2026-06-15',
      value: -5625,
      identificador: 'id-vidrosul',
      descricao: 'Transferência enviada pelo Pix - VIDROSUL COMERCIO DE VIDROS E BOX LTDA - 04.121.502/0001-21 - CAIXA ECONOMICA FEDERAL (0104) Agência: 953 Conta: 1292000000578327066-7',
    });
  });
});

describe('excludeReversedPix', () => {
  it('cancela o par Pix + Estorno com o mesmo Identificador e valores opostos', () => {
    const rows = parseNubankStatementCsv(SAMPLE_CSV);
    const kept = excludeReversedPix(rows);

    expect(kept.some((row) => row.identificador === 'id-estorno')).toBe(false);
    expect(kept).toHaveLength(7);
  });

  it('não mexe em linhas com Identificador único', () => {
    const rows = [{ identificador: 'a', value: 100 }, { identificador: 'b', value: -50 }];
    expect(excludeReversedPix(rows)).toHaveLength(2);
  });
});

describe('classifyStatementRow', () => {
  it('extrai o nome do recebedor num Pix enviado', () => {
    const result = classifyStatementRow({
      value: -5625,
      descricao: 'Transferência enviada pelo Pix - VIDROSUL COMERCIO DE VIDROS E BOX LTDA - 04.121.502/0001-21 - CAIXA ECONOMICA FEDERAL (0104) Agência: 953 Conta: 1292000000578327066-7',
    });

    expect(result).toMatchObject({
      transactionType: 'pix_sent',
      direction: 'out',
      amount: 5625,
      merchant: 'VIDROSUL COMERCIO DE VIDROS E BOX LTDA',
    });
  });

  it('reconhece "Transferência Recebida" sem "pelo Pix"', () => {
    const result = classifyStatementRow({ value: 240, descricao: 'Transferência Recebida - Geovana Martins Costa - •••.135.701-•• - NU PAGAMENTOS - IP (0260) Agência: 1 Conta: 73702330-3' });
    expect(result).toMatchObject({ transactionType: 'pix_received', direction: 'in', merchant: 'Geovana Martins Costa' });
  });

  it('trata boleto já pago como saída, não como boleto_issued (que criaria um "previsto")', () => {
    const result = classifyStatementRow({ value: -129.99, descricao: 'Pagamento de boleto efetuado - SP NET INTERNET GOIATUBA' });
    expect(result).toMatchObject({ transactionType: 'pix_sent', direction: 'out', merchant: 'SP NET INTERNET GOIATUBA' });
  });

  it('trata Aplicação/Resgate RDB como transferência interna pendente (as 2 pontas ficam pro usuário escolher)', () => {
    const aplicacao = classifyStatementRow({ value: -831, descricao: 'Aplicação RDB' });
    expect(aplicacao).toMatchObject({ transactionType: 'internal_transfer', direction: 'out', amount: 831, needsBothAccounts: true });

    const resgate = classifyStatementRow({ value: 350, descricao: 'Resgate RDB' });
    expect(resgate).toMatchObject({ transactionType: 'internal_transfer', direction: 'in', amount: 350 });
  });

  it('ignora Pagamento de fatura (já tem fluxo próprio em Despesas)', () => {
    expect(classifyStatementRow({ value: -5581.44, descricao: 'Pagamento de fatura' })).toBeNull();
  });
});

describe('buildStatementImportPlan', () => {
  it('monta o plano final: RDB vira transferência a revisar, fatura fica de fora, par estornado some, dedupe_key estável', () => {
    const rows = parseNubankStatementCsv(SAMPLE_CSV);
    const plan = buildStatementImportPlan(rows, { rules: [] });

    expect(plan).toHaveLength(6);
    expect(plan.map((item) => item.dedupeKey)).toEqual([
      'nubank_csv:id-vidrosul',
      'nubank_csv:id-resgate',
      'nubank_csv:id-aplicacao',
      'nubank_csv:id-boleto',
      'nubank_csv:id-recebido',
      'nubank_csv:id-recebido2',
    ]);
    expect(plan.find((item) => item.dedupeKey === 'nubank_csv:id-aplicacao').transactionType).toBe('internal_transfer');
  });

  it('regra do usuário tem prioridade sobre o classificador embutido', () => {
    const rows = parseNubankStatementCsv(SAMPLE_CSV);
    const rules = [{ keyword: 'vidrosul', category: 'esquadrias', segment: 'kitnets', enabled: true }];
    const plan = buildStatementImportPlan(rows, { rules });

    const vidrosul = plan.find((item) => item.dedupeKey === 'nubank_csv:id-vidrosul');
    expect(vidrosul.categorySuggested).toBe('esquadrias');
    expect(vidrosul.costCenterSuggested).toBe('kitnets');
  });
});
