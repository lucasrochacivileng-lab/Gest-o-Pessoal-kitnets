import { describe, expect, it } from 'vitest';
import {
  buildInstallmentKey,
  buildInstallmentPreview,
  classifyTransaction,
  merchantOf,
  parseDate,
  parseMoney,
  parseStatementRows,
  refundTargetName,
  summarizeByCategory,
} from './cardStatementImportService.js';

describe('cardStatementImportService', () => {
  it('detecta colunas comuns de fatura e parcelas no texto', () => {
    const rows = parseStatementRows([
      {
        Data: '08/07/2026',
        Descricao: 'Mercado Pago Ar condicionado Kit 08 5/21',
        Valor: '199,90',
        Cartao: 'Mercado Pago Pai',
      },
    ]);

    expect(rows).toMatchObject([
      {
        purchase_date: '2026-07-08',
        description: 'Mercado Pago Ar condicionado Kit 08 5/21',
        value: 199.9,
        card_name: 'Mercado Pago Pai',
        installment_current: 5,
        installment_total: 21,
      },
    ]);
  });

  it('normaliza cartao adicional para o titular (Santander 7535 -> 7909)', () => {
    const rows = parseStatementRows([
      { Data: '10/07/2026', Descricao: 'CLARO FLEX', Valor: '39,99', Cartao: 'Santander 7535' },
      { Data: '10/07/2026', Descricao: 'Compra qualquer', Valor: '100,00', Cartao: 'Santander 7909' },
    ]);

    expect(rows.map((row) => row.card_name)).toEqual(['Santander 7909', 'Santander 7909']);
  });

  it('interpreta CSV do Nubank e ignora pagamentos recebidos', () => {
    const rows = parseStatementRows([
      {
        date: '2026-07-01',
        title: 'Ronaldo Ferragista - Parcela 1/2',
        amount: '130,00',
      },
      {
        date: '2026-06-10',
        title: 'Pagamento recebido',
        amount: '- 5.581,44',
      },
    ], { defaultCardName: 'Nubank' });

    expect(rows).toMatchObject([
      {
        purchase_date: '2026-07-01',
        description: 'Ronaldo Ferragista - Parcela 1/2',
        value: 130,
        card_name: 'Nubank',
        installment_current: 1,
        installment_total: 2,
      },
    ]);
  });

  it('aceita datas americanas geradas por planilhas sem criar mês inválido', () => {
    expect(parseDate('6/30/26')).toBe('2026-06-30');
    expect(parseDate('30/6/26')).toBe('2026-06-30');
  });

  it('gera parcelas futuras a partir da parcela atual', () => {
    const preview = buildInstallmentPreview({
      statementMonth: '2026-07',
      dueDay: 10,
      transactions: [
        {
          purchase_date: '2026-07-08',
          description: 'Mercado Pago Ar condicionado Kit 08',
          value: 250,
          card_name: 'Mercado Pago Pai',
          installment_current: 20,
          installment_total: 21,
        },
      ],
      kitnets: [{ id: 'k8', name: 'Kitnet 08' }],
    });

    expect(preview).toHaveLength(2);
    expect(preview[0]).toMatchObject({
      date: '2026-07-10',
      installment: '20/21',
      category: 'investimento kitnets',
      context: 'obra',
      segment: 'kitnets', // gasto de obra começa como investimento nas kitnets
      kitnet_id: 'k8',
    });
    expect(preview[1]).toMatchObject({ date: '2026-08-10', installment: '21/21' });
  });

  it('compra sem classificacao de obra comeca no segmento pessoal', () => {
    const preview = buildInstallmentPreview({
      statementMonth: '2026-07',
      dueDay: 10,
      transactions: [
        {
          purchase_date: '2026-07-08',
          description: 'Padaria do bairro',
          value: 30,
          card_name: 'Nubank',
          installment_current: 1,
          installment_total: 1,
        },
      ],
    });

    expect(preview[0].segment).toBe('pessoal');
  });

  it('marca duplicidade por data, descricao, valor, cartao e parcela', () => {
    const preview = buildInstallmentPreview({
      statementMonth: '2026-07',
      dueDay: 10,
      transactions: [
        {
          purchase_date: '2026-07-08',
          description: 'Posto combustivel',
          value: 100,
          card_name: 'Nubank',
          installment_current: 1,
          installment_total: 1,
        },
      ],
      existingTransactions: [
        {
          origin_hash: 'nubank|2026-07-08|posto combustivel|100.00|1/1',
        },
      ],
    });

    expect(preview[0].duplicate).toBe(true);
  });

  it('marca so a primeira parcela como substituta da compra vinda de notificacao', () => {
    const preview = buildInstallmentPreview({
      statementMonth: '2026-08',
      dueDay: 10,
      transactions: [
        {
          source_index: 1,
          purchase_date: '2026-07-10',
          description: 'PIZZARIA BELLA LTDA',
          value: 100,
          card_name: 'Nubank',
          installment_current: 1,
          installment_total: 6,
        },
      ],
      existingTransactions: [
        {
          id: 'n1',
          type: 'card_transaction',
          source_notification_id: 'notif-1',
          card_name: 'Nubank',
          description: 'Compra aprovada: PIZZARIA BELLA',
          value: 600,
          date: '2026-07-10',
          status: 'revisado',
        },
      ],
    });

    expect(preview).toHaveLength(6);
    // A notificação é uma só (os R$ 600 cheios) e é aposentada uma vez só:
    // se todas as 6 parcelas carregassem o vínculo, o app tentaria ignorá-la
    // seis vezes ao salvar.
    expect(preview[0]).toMatchObject({ supersedes_id: 'n1', supersedes_value: 600 });
    expect(preview.slice(1).every((row) => !row.supersedes_id)).toBe(true);
  });

  it('nao marca substituicao quando a compra nao veio de notificacao', () => {
    const preview = buildInstallmentPreview({
      statementMonth: '2026-08',
      dueDay: 10,
      transactions: [
        {
          source_index: 1,
          purchase_date: '2026-07-10',
          description: 'PIZZARIA BELLA LTDA',
          value: 600,
          card_name: 'Nubank',
          installment_current: 1,
          installment_total: 1,
        },
      ],
      // Mesmo cartão, valor e data, mas veio de uma importação anterior
      // (origin_hash), não da Caixa de Entrada — não é o caso deste casamento.
      existingTransactions: [
        {
          id: 'x1',
          type: 'card_transaction',
          origin_hash: 'outro',
          card_name: 'Nubank',
          description: 'PIZZARIA BELLA LTDA',
          value: 600,
          date: '2026-07-10',
        },
      ],
    });

    expect(preview[0].supersedes_id).toBeUndefined();
  });

  it('interpreta valores acima de R$ 1 milhão (dois separadores de milhar)', () => {
    expect(parseMoney('1.234.567,89')).toBeCloseTo(1234567.89);
    expect(parseMoney('12.345,67')).toBeCloseTo(12345.67);
    expect(parseMoney('R$ 1.000.000,00')).toBeCloseTo(1000000);
  });

  it('interpreta valores no formato americano (vírgula de milhar, ponto decimal)', () => {
    expect(parseMoney('1,234,567.89')).toBeCloseTo(1234567.89);
  });

  it('nao confunde Kit 01 com Kitnet 15 (mesmo prefixo " 1")', () => {
    const preview = buildInstallmentPreview({
      statementMonth: '2026-07',
      dueDay: 10,
      transactions: [
        {
          purchase_date: '2026-07-08',
          description: 'Loja Kit 01 Materiais',
          value: 100,
          card_name: 'Nubank',
          installment_current: 1,
          installment_total: 1,
        },
      ],
      kitnets: [
        { id: 'k15', name: 'Kitnet 15' },
        { id: 'k1', name: 'Kitnet 01' },
      ],
    });

    expect(preview[0].kitnet_id).toBe('k1');
  });

  it('nao descarta a compra quando a parcela total vem menor que a atual (dado malformado)', () => {
    const preview = buildInstallmentPreview({
      statementMonth: '2026-07',
      dueDay: 10,
      transactions: [
        {
          purchase_date: '2026-07-08',
          description: 'Compra com parcela malformada',
          value: 300,
          card_name: 'Nubank',
          installment_current: 5,
          installment_total: 3,
        },
      ],
    });

    expect(preview.length).toBeGreaterThan(0);
    expect(preview[0].installment).toBe('5/5');
  });

  it('reconhece a parcela que a importacao anterior ja projetou, mesmo com rotulo e centavo diferentes', () => {
    // Caso real da fatura Nubank de 10/08/2026: a compra saiu como
    // "Parcela 1/3" (R$ 523,18) na fatura de junho, que já projetou a 2/3 para
    // 10/08. Na fatura de agosto a MESMA compra volta como "Parcela 2/3" com
    // R$ 523,16 e purchase_date do ciclo novo — nada disso bate no origin_hash.
    const preview = buildInstallmentPreview({
      statementMonth: '2026-08',
      dueDay: 10,
      transactions: [
        {
          purchase_date: '2026-07-03',
          description: 'Irmaossoares - Parcela 2/3',
          value: 523.16,
          card_name: 'Nubank',
          installment_current: 2,
          installment_total: 3,
        },
      ],
      existingTransactions: [
        {
          id: 'antigo-2de3',
          type: 'card_transaction',
          card_name: 'Nubank',
          description: 'Irmaossoares - Parcela 1/3',
          value: 523.18,
          date: '2026-08-10',
          installment: '2/3',
          origin_hash: 'nubank|2026-06-13|irmaossoares - parcela 1/3|523.18|2/3',
          status: 'revisar',
        },
        {
          id: 'antigo-3de3',
          type: 'card_transaction',
          card_name: 'Nubank',
          description: 'Irmaossoares - Parcela 1/3',
          value: 523.18,
          date: '2026-09-10',
          installment: '3/3',
          origin_hash: 'nubank|2026-06-13|irmaossoares - parcela 1/3|523.18|3/3',
          status: 'revisar',
        },
      ],
    });

    expect(preview.map((row) => row.duplicate)).toEqual([true, true]);
  });

  it('nao casa duas compras diferentes do mesmo estabelecimento na mesma parcela', () => {
    // "Irmaossoares - Parcela 5/6" aparece três vezes na mesma fatura, com
    // valores diferentes: são compras distintas. Só a que já foi projetada pode
    // ser marcada como duplicata.
    const transacao = (value) => ({
      purchase_date: '2026-07-03',
      description: 'Irmaossoares - Parcela 5/6',
      value,
      card_name: 'Nubank',
      installment_current: 5,
      installment_total: 6,
    });

    const preview = buildInstallmentPreview({
      statementMonth: '2026-08',
      dueDay: 10,
      transactions: [transacao(70.56), transacao(13.07), transacao(19.85)],
      existingTransactions: [
        {
          id: 'antigo',
          type: 'card_transaction',
          card_name: 'Nubank',
          description: 'Irmaossoares - Parcela 4/6',
          value: 13.07,
          date: '2026-08-10',
          installment: '5/6',
          status: 'revisar',
        },
      ],
    });

    const agosto = preview.filter((row) => row.date === '2026-08-10');
    expect(agosto.find((row) => row.value === 13.07).duplicate).toBe(true);
    expect(agosto.find((row) => row.value === 70.56).duplicate).toBe(false);
    expect(agosto.find((row) => row.value === 19.85).duplicate).toBe(false);
  });

  it('nao trata duas compras a vista iguais como duplicata uma da outra', () => {
    // Dois pedágios de R$ 14,59 comprados em dias diferentes caem no mesmo
    // vencimento com parcela "1/1". Compra à vista nunca é reprojetada, então
    // aqui só o hash exato vale — a tolerância não pode entrar.
    const preview = buildInstallmentPreview({
      statementMonth: '2026-08',
      dueDay: 10,
      transactions: [
        {
          purchase_date: '2026-07-20',
          description: 'NuTag*QQP8C28',
          value: 14.59,
          card_name: 'Nubank',
          installment_current: 1,
          installment_total: 1,
        },
        {
          purchase_date: '2026-07-17',
          description: 'NuTag*QQP8C28',
          value: 14.59,
          card_name: 'Nubank',
          installment_current: 1,
          installment_total: 1,
        },
      ],
      existingTransactions: [
        {
          id: 'ja-importado',
          type: 'card_transaction',
          card_name: 'Nubank',
          description: 'NuTag*QQP8C28',
          value: 14.59,
          date: '2026-08-10',
          installment: '1/1',
          origin_hash: 'nubank|2026-07-20|nutag*qqp8c28|14.59|1/1',
          status: 'revisar',
        },
      ],
    });

    expect(preview.map((row) => row.duplicate)).toEqual([true, false]);
  });

  it('estorno anula a compra correspondente da propria fatura', () => {
    // Fatura Nubank de agosto: duas assinaturas de R$ 110 (09/07 e 17/07) e um
    // estorno de -R$ 110 em 16/07. O estorno devolve a cobrança ANTERIOR a ele
    // (09/07); a de 17/07 continua valendo.
    const rows = parseStatementRows([
      { date: '2026-07-17', title: 'Google Claude By Anth', amount: '110,00' },
      { date: '2026-07-16', title: 'Estorno de "Google Claude By Anth" (Google Claude By Anth)', amount: '- 110,00' },
      { date: '2026-07-09', title: 'Google Claude By Anth', amount: '110,00' },
      { date: '2026-07-10', title: 'Pagamento recebido', amount: '- 7.023,41' },
    ], { defaultCardName: 'Nubank' });

    // O pagamento da fatura anterior sai; as duas compras ficam.
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.purchase_date === '2026-07-09').refunded).toBe(true);
    expect(rows.find((row) => row.purchase_date === '2026-07-17').refunded).toBeUndefined();

    const preview = buildInstallmentPreview({
      statementMonth: '2026-08',
      dueDay: 10,
      transactions: rows,
    });

    const estornada = preview.find((row) => row.purchase_date === '2026-07-09');
    const valida = preview.find((row) => row.purchase_date === '2026-07-17');
    expect(estornada.status).toBe('ignorar');
    expect(valida.status).toBe('revisar');
  });

  it('extrai o estabelecimento da descricao do estorno e da parcela', () => {
    expect(refundTargetName('Estorno de "Google Claude By Anth" (Google Claude By Anth)')).toBe('Google Claude By Anth');
    expect(refundTargetName('Estorno de Loja Qualquer')).toBe('Loja Qualquer');
    expect(merchantOf('Irmaossoares - Parcela 12/12')).toBe('irmaossoares');
    expect(merchantOf('Raia Drogasil - NuPay - Parcela 1/3')).toBe('raia drogasil - nupay');
    // Bradescard/Amazon escreve a parcela entre parenteses, colada no nome.
    expect(merchantOf('AMAZONMKTPLC*MMSCOMERC SAO PAULO(05/10)')).toBe('amazonmktplc*mmscomerc sao paulo');
    expect(merchantOf('AMAZON MARKETPLACE CC SAO PAULO(04/10)')).toBe('amazon marketplace cc sao paulo');
    expect(buildInstallmentKey({
      card_name: 'Nubank', date: '2026-08-10', description: 'Fotus Energia Solar - Parcela 5/12', installment: '6/12',
    })).toBe(buildInstallmentKey({
      card_name: 'Nubank', date: '2026-08-10', description: 'Fotus Energia Solar - Parcela 6/12', installment: '6/12',
    }));
  });

  it('classifica gastos conhecidos e soma por categoria', () => {
    expect(classifyTransaction('Posto Shell')).toEqual({ category: 'combustivel', context: 'pessoal' });
    expect(classifyTransaction('NuTag*QQP8C28')).toEqual({ category: 'transporte', context: 'pessoal' });
    expect(classifyTransaction('Casa das Tintas')).toEqual({ category: 'material de construcao', context: 'obra' });
    expect(classifyTransaction('Ki Kitandas')).toEqual({ category: 'mercado', context: 'pessoal' });
    expect(classifyTransaction('Marcaobarbearia')).toEqual({ category: 'lazer', context: 'pessoal' });
    expect(classifyTransaction('Fotus Energia Solar')).toEqual({ category: 'investimento kitnets', context: 'obra' });

    expect(summarizeByCategory([
      { category: 'combustivel', value: 50 },
      { category: 'combustivel', value: 70 },
      { category: 'mercado', value: 100 },
    ])).toEqual({ combustivel: 120, mercado: 100 });
  });
});
