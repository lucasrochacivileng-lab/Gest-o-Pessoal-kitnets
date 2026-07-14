import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout.jsx';
import Dashboard from '../../modules/dashboard/pages/index.jsx';
import Recebimentos from '../../modules/receivables/pages/ReceivablesPage.jsx';
import Kitnets from '../../modules/kitnets/pages/index.jsx';
import Contratos from '../../modules/contracts/pages/index.jsx';
import Tenants from '../../modules/tenants/pages/index.jsx';
import FinancialOverview from '../../pages/FinancialOverview.jsx';
import Consolidated from '../../pages/Consolidated.jsx';
import KitnetResult from '../../pages/KitnetResult.jsx';
import Statement from '../../pages/Statement.jsx';
import Income from '../../pages/Income.jsx';
import Payments from '../../pages/Payments.jsx';
import Expenses from '../../pages/Expenses.jsx';
import ConstructionPage from '../../pages/ConstructionPage.jsx';
import CreditCards from '../../pages/CreditCards.jsx';
import ClassificationRules from '../../pages/ClassificationRules.jsx';
import Documents from '../../pages/Documents.jsx';
import Settings from '../../pages/Settings.jsx';
import Reports from '../../pages/Reports.jsx';
import PersonalFinances from '../../pages/PersonalFinances.jsx';
import Forecast from '../../pages/Forecast.jsx';
import CategoryReport from '../../pages/CategoryReport.jsx';
import ComplementaryProjects from '../../pages/ComplementaryProjects.jsx';
import ExpertReports from '../../pages/ExpertReports.jsx';
import NotificationsPage from '../../modules/notifications/pages/NotificationsPage.jsx';
import CashReconciliation from '../../pages/CashReconciliation.jsx';
import HubLayout from '../../components/ui/HubLayout.jsx';

// Abas dos hubs (fases 2 e 3): as URLs continuam as mesmas, só ganham uma
// barra de abas no topo e uma única entrada no menu lateral. Recebimentos,
// Pagamentos e Finanças Pessoais deixam de ser itens soltos e viram abas
// dentro de "Financeiro".
const FINANCE_TABS = [
  { to: '/receitas', label: 'Receitas' },
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

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />

        {/* Hub Financeiro (abas no topo, mesmas URLs) */}
        <Route element={<HubLayout tabs={FINANCE_TABS} />}>
          <Route path="/receitas" element={<Income />} />
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
        <Route path="/locatarios" element={<Tenants />} />
        <Route path="/contratos" element={<Contratos />} />
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
  );
}
