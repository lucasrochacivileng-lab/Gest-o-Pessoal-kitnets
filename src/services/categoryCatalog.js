// Catálogo ÚNICO de categorias do app. Antes, três listas viviam separadas e
// divergiam entre si (Despesas, Cartões/Regras e os rótulos do relatório por
// categoria) — qualquer ajuste tinha que ser feito em três lugares. Agora todas
// as telas importam daqui.
//
// IMPORTANTE: os VALORES gravados no banco não mudam (ex.: cartão continua
// gravando 'material de construcao' com espaços) — mudar valor exigiria
// migração dos dados já lançados. O que este módulo unifica é a FONTE das
// listas e dos rótulos; a conciliação entre vocabulários segue feita por
// normalizeCategory/aliases no categoryReportService.

// Rótulos por chave normalizada (slug) — usados pelo relatório de gastos por
// categoria e por qualquer tela que precise exibir uma categoria "crua".
export const CATEGORY_LABELS = {
  agua: 'Água',
  luz: 'Luz',
  energia_solar: 'Energia solar',
  moveis: 'Móveis/eletro',
  internet: 'Internet',
  iptu: 'IPTU',
  seguro: 'Seguro',
  limpeza: 'Limpeza',
  material: 'Material de obra',
  manutencao: 'Manutenção',
  obra: 'Obra',
  alimentacao: 'Alimentação',
  combustivel: 'Combustível',
  pessoal: 'Pessoal',
  moradia: 'Moradia / aluguel',
  energia: 'Energia',
  gas: 'Gás',
  mercado: 'Mercado',
  farmacia: 'Farmácia',
  assinatura: 'Assinaturas',
  transporte: 'Transporte',
  telefone: 'Telefone',
  lazer: 'Lazer',
  familia: 'Família',
  impostos: 'Impostos',
  emprestimos: 'Empréstimos / financiamento',
  tarifas_bancarias: 'Tarifas bancárias',
  outro: 'Outros',
  sem_categoria: 'Sem categoria',
};

// Categorias de DESPESA DIRETA das kitnets (tela Despesas). Valores legados
// preservados (ex.: 'outro' no singular).
export const EXPENSE_CATEGORY_OPTIONS = [
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'agua', label: 'Água' },
  { value: 'luz', label: 'Luz / Energia' },
  { value: 'energia_solar', label: 'Energia solar (parcela)' },
  { value: 'moveis', label: 'Móveis/eletrodomésticos (parcela)' },
  { value: 'internet', label: 'Internet' },
  { value: 'iptu', label: 'IPTU' },
  { value: 'seguro', label: 'Seguro' },
  { value: 'limpeza', label: 'Limpeza' },
  { value: 'material', label: 'Material' },
  { value: 'obra', label: 'Obra' },
  { value: 'outro', label: 'Outro' },
];

// Categorias de COMPRA DE CARTÃO (importação, lançamento manual, seletor
// inline de Despesas e Regras de classificação). Valores legados preservados
// (com espaços e 'outros' no plural). Também é o vocabulário que
// getCostType() lê para derivar Custeio/Investimento/Financiamento.
export const CARD_CATEGORY_OPTIONS = [
  { value: 'energia', label: 'Energia' },
  { value: 'agua', label: 'Água' },
  { value: 'internet', label: 'Internet' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'mercado', label: 'Mercado' },
  { value: 'combustivel', label: 'Combustível' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'farmacia', label: 'Farmácia' },
  { value: 'lazer', label: 'Lazer' },
  { value: 'assinatura', label: 'Assinaturas' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'familia', label: 'Família' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'emprestimos', label: 'Empréstimos / financiamento' },
  { value: 'material de construcao', label: 'Material de construção' },
  { value: 'investimento kitnets', label: 'Investimento nas kitnets' },
  { value: 'tarifas bancarias', label: 'Tarifas bancárias' },
  { value: 'outros', label: 'Outros' },
];

export default {
  CATEGORY_LABELS,
  EXPENSE_CATEGORY_OPTIONS,
  CARD_CATEGORY_OPTIONS,
};
