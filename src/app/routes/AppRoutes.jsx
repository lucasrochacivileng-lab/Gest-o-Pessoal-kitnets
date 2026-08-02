import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout.jsx';
import Dashboard from '../../modules/dashboard/pages/index.jsx';
import HubLayout from '../../components/ui/HubLayout.jsx';
import StatePanel from '../../components/ui/StatePanel.jsx';

// Cada tela vira um chunk carregado sob demanda (em vez de tudo num arquivo
// só de 650kB+): quem abre o Dashboard não baixa o código de Cartões,
// Relatórios etc. até entrar nessas telas — mais rápido no celular.
const Recebimentos = lazy(() => import('../../modules/receivables/pages/ReceivablesPage.jsx'));
const Kitnets = lazy(() => import('../../modules/kitnets/pages/index.jsx'));
const Contratos = lazy(() => import('../../modules/contracts/pages/index.jsx'));
const FinancialOverview = lazy(() => import('../../pages/FinancialOverview.jsx'));
const Consolidated = lazy(() => import('../../pages/Consolidated.jsx'));
const KitnetResult = lazy(() => import('../../pages/KitnetResult.jsx'));
const Statement = lazy(() => import('../../pages/Statement.jsx'));
const Income = lazy(() => import('../../pages/Income.jsx'));
const Payments = lazy(() => import('../../pages/Payments.jsx'));
const Expenses = lazy(() => import('../../pages/Expenses.jsx'));
const ConstructionPage = lazy(() => import('../../pages/ConstructionPage.jsx'));
const CreditCards = lazy(() => import('../../pages/CreditCards.jsx'));
const ClassificationRules = lazy(() => import('../../pages/ClassificationRules.jsx'));
const Documents = lazy(() => import('../../pages/Documents.jsx'));
const Settings = lazy(() => import('../../pages/Settings.jsx'));
const Reports = lazy(() => import('../../pages/Reports.jsx'));
const PersonalFinances = lazy(() => import('../../pages/PersonalFinances.jsx'));
const Forecast = lazy(() => import('../../pages/Forecast.jsx'));
const CategoryReport = lazy(() => import('../../pages/CategoryReport.jsx'));
const ComplementaryProjects = lazy(() => import('../../pages/ComplementaryProjects.jsx'));
const ExpertReports = lazy(() => import('../../pages/ExpertReports.jsx'));
const NotificationsPage = lazy(() => import('../../modules/notifications/pages/NotificationsPage.jsx'));
const CashReconciliation = lazy(() => import('../../pages/CashReconciliation.jsx'));
const FinancialInbox = lazy(() => import('../../pages/FinancialInbox.jsx'));

// Abas dos hubs (fases 2 e 3): as URLs continuam as mesmas, só ganham uma
// barra de abas no topo e uma única entrada no menu lateral. Recebimentos,
// Pagamentos e Finanças Pessoais deixam de ser itens soltos e viram abas
// dentro de "Financeiro".
const FINANCE_TABS = [
  { to: '/receitas', label: 'Receitas' },
  { to: '/caixa-entrada', label: 'Caixa de Entrada' },
  { to: '/recebimentos', label: 'Recebimentos' },
  { to: '/despesas', label: 'Despesas' },
  { to: '/pagamentos', label: 'Pagamentos' },
  { to: '/extrato', label: 'Extrato' },
  { to: '/caixa', label: 'Caixa' },
  { to: '/financas-pessoais', label: 'Pessoal' },
];

const REPORT_TABS = [
  { to: '/visao-geral', label: 'Visão Geral' },
  { to: '/consolidado', label: 'Consolidado' },
  { to: '/resultado-kitnets', label: 'Por kitnet' },
  { to: '/gastos-categoria', label: 'Categorias' },
  { to: '/previsao', label: 'Previsão' },
  { to: '/relatorios', label: 'Exportar' },
];

const routeFallback = <StatePanel type="loading" title="Carregando..." />;

export default function AppRoutes() {
  return (
    <Suspense fallback={routeFallback}>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />

        {/* Hub Financeiro (abas no topo, mesmas URLs) */}
        <Route element={<HubLayout tabs={FINANCE_TABS} />}>
          <Route path="/receitas" element={<Income />} />
          <Route path="/caixa-entrada" element={<FinancialInbox />} />
          <Route path="/recebimentos" element={<Recebimentos />} />
          <Route path="/recebimentos/:id" element={<Recebimentos />} />
          <Route path="/despesas" element={<Expenses />} />
          <Route path="/despesas/:id" element={<Expenses />} />
          <Route path="/pagamentos" element={<Payments />} />
          <Route path="/extrato" element={<Statement />} />
          <Route path="/caixa" element={<CashReconciliation />} />
          <Route path="/financas-pessoais" element={<PersonalFinances />} />
        </Route>

        {/* Hub Relatórios (só análise) */}
        <Route element={<HubLayout tabs={REPORT_TABS} />}>
          <Route path="/visao-geral" element={<FinancialOverview />} />
          <Route path="/consolidado" element={<Consolidated />} />
          <Route path="/resultado-kitnets" element={<KitnetResult />} />
          <Route path="/gastos-categoria" element={<CategoryReport />} />
          <Route path="/previsao" element={<Forecast />} />
          <Route path="/relatorios" element={<Reports />} />
        </Route>

        <Route path="/kitnets" element={<Kitnets />} />
        <Route path="/locacoes" element={<Contratos />} />
        <Route path="/locatarios" element={<Navigate to="/locacoes" replace />} />
        <Route path="/contratos" element={<Navigate to="/locacoes" replace />} />
        <Route path="/contratos/:id" element={<Contratos />} />
        <Route path="/obra" element={<ConstructionPage />} />
        <Route path="/pericias" element={<ExpertReports />} />
        <Route path="/pericias/:id" element={<ExpertReports />} />
        <Route path="/projetos" element={<ComplementaryProjects />} />
        <Route path="/projetos/:id" element={<ComplementaryProjects />} />
        <Route path="/cartoes" element={<CreditCards />} />
        <Route path="/regras-classificacao" element={<ClassificationRules />} />
        <Route path="/documentos" element={<Documents />} />
        <Route path="/notificacoes" element={<NotificationsPage />} />
        <Route path="/configuracoes" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
