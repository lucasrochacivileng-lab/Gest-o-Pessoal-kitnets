import React from 'react';
import EntityPage from '../components/ui/EntityPage.jsx';

const moduleConfigs = {
  PersonalIncome: {
    subtitle: 'Controle de receitas e despesas pessoais fora das kitnets',
    fields: [
      {
        name: 'type',
        label: 'Tipo',
        type: 'select',
        options: [
          { value: 'receita', label: 'Receita' },
          { value: 'despesa', label: 'Despesa' },
        ],
      },
      { name: 'description', label: 'Descrição', placeholder: 'Salário, consultoria, mercado...' },
      {
        name: 'category',
        label: 'Categoria',
        type: 'select',
        options: [
          { value: 'salario', label: 'Salário' },
          { value: 'servico', label: 'Serviço' },
          { value: 'investimento', label: 'Investimento' },
          { value: 'moradia', label: 'Moradia' },
          { value: 'alimentacao', label: 'Alimentação' },
          { value: 'transporte', label: 'Transporte' },
          { value: 'saude', label: 'Saúde' },
          { value: 'outro', label: 'Outro' },
        ],
      },
      { name: 'value', label: 'Valor', type: 'number', placeholder: '2500' },
      { name: 'date', label: 'Data', type: 'date' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'previsto', label: 'Previsto' },
          { value: 'recebido', label: 'Recebido' },
          { value: 'pago', label: 'Pago' },
          { value: 'pendente', label: 'Pendente' },
        ],
      },
      { name: 'account', label: 'Conta', placeholder: 'Itaú, Nubank, dinheiro' },
      { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Detalhes do lançamento' },
    ],
    cardFields: ['date', 'description', 'value', 'status'],
  },
  ExpertReport: {
    subtitle: 'Acompanhamento de perícias judiciais, prazos e honorários',
    fields: [
      { name: 'process_number', label: 'Número do processo', placeholder: '0000000-00.0000.0.00.0000' },
      { name: 'client', label: 'Cliente/parte', placeholder: 'Nome do cliente ou parte' },
      { name: 'court', label: 'Vara/comarca', placeholder: '1ª Vara Cível de Goiânia' },
      {
        name: 'report_type',
        label: 'Tipo de perícia',
        type: 'select',
        options: [
          { value: 'engenharia', label: 'Engenharia' },
          { value: 'avaliacao', label: 'Avaliação' },
          { value: 'vistoria', label: 'Vistoria' },
          { value: 'assistencia_tecnica', label: 'Assistência técnica' },
          { value: 'outro', label: 'Outro' },
        ],
      },
      { name: 'due_date', label: 'Prazo', type: 'date' },
      { name: 'fee_value', label: 'Honorários', type: 'number', placeholder: '3500' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'em analise', label: 'Em análise' },
          { value: 'em andamento', label: 'Em andamento' },
          { value: 'entregue', label: 'Entregue' },
          { value: 'recebido', label: 'Recebido' },
          { value: 'arquivado', label: 'Arquivado' },
        ],
      },
      { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Próximos passos, documentos pendentes...' },
    ],
    cardFields: ['process_number', 'client', 'status'],
  },
  ComplementaryProject: {
    subtitle: 'Controle de projetos complementares, prazos e recebimentos',
    fields: [
      { name: 'client', label: 'Cliente', placeholder: 'Nome do cliente' },
      {
        name: 'project_type',
        label: 'Tipo de projeto',
        type: 'select',
        options: [
          { value: 'eletrico', label: 'Elétrico' },
          { value: 'hidraulico', label: 'Hidráulico' },
          { value: 'estrutural', label: 'Estrutural' },
          { value: 'incendio', label: 'Prevenção contra incêndio' },
          { value: 'arquitetonico', label: 'Arquitetônico' },
          { value: 'outro', label: 'Outro' },
        ],
      },
      { name: 'address', label: 'Endereço/obra', placeholder: 'Endereço da obra' },
      { name: 'value', label: 'Valor', type: 'number', placeholder: '4500' },
      { name: 'due_date', label: 'Prazo', type: 'date' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'orcamento', label: 'Orçamento' },
          { value: 'aprovado', label: 'Aprovado' },
          { value: 'em andamento', label: 'Em andamento' },
          { value: 'entregue', label: 'Entregue' },
          { value: 'recebido', label: 'Recebido' },
        ],
      },
      { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Escopo, pendências e contatos' },
    ],
    cardFields: ['client', 'project_type', 'status'],
  },
};

const defaultConfig = {
  subtitle: 'Cadastre e acompanhe registros deste módulo',
  fields: [
    { name: 'title', label: 'Título' },
    { name: 'status', label: 'Status' },
    { name: 'notes', label: 'Observações', type: 'textarea' },
  ],
  cardFields: ['title', 'status'],
};

export default function GenericModule({ title, entity }) {
  const config = moduleConfigs[entity] || defaultConfig;

  return (
    <EntityPage
      title={title}
      subtitle={config.subtitle}
      entity={entity}
      fields={config.fields}
      cardFields={config.cardFields}
    />
  );
}
