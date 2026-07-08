import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout.jsx';
import Dashboard from '../../modules/dashboard/pages/index.jsx';
import Recebimentos from '../../modules/receivables/pages/ReceivablesPage.jsx';
import Kitnets from '../../modules/kitnets/pages/index.jsx';
import Contratos from '../../modules/contracts/pages/index.jsx';
import Tenants from '../../modules/tenants/pages/index.jsx';
import GenericModule from '../../pages/GenericModule.jsx';
import FinancialOverview from '../../pages/FinancialOverview.jsx';
import Payments from '../../pages/Payments.jsx';
import Expenses from '../../pages/Expenses.jsx';
import ConstructionPage from '../../pages/ConstructionPage.jsx';
import CreditCards from '../../pages/CreditCards.jsx';
import Documents from '../../pages/Documents.jsx';
import Settings from '../../pages/Settings.jsx';
import Reports from '../../pages/Reports.jsx';
import PersonalFinances from '../../pages/PersonalFinances.jsx';
import NotificationsPage from '../../modules/notifications/pages/NotificationsPage.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/visao-geral" element={<FinancialOverview />} />
        <Route path="/kitnets" element={<Kitnets />} />
        <Route path="/locatarios" element={<Tenants />} />
        <Route path="/contratos" element={<Contratos />} />
        <Route path="/contratos/:id" element={<Contratos />} />
        <Route path="/recebimentos" element={<Recebimentos />} />
        <Route path="/recebimentos/:id" element={<Recebimentos />} />
        <Route path="/pagamentos" element={<Payments />} />
        <Route path="/despesas" element={<Expenses />} />
        <Route path="/despesas/:id" element={<Expenses />} />
        <Route path="/obra" element={<ConstructionPage />} />
        <Route path="/cartoes" element={<CreditCards />} />
        <Route path="/documentos" element={<Documents />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="/notificacoes" element={<NotificationsPage />} />
        <Route path="/configuracoes" element={<Settings />} />
        <Route path="/financas-pessoais" element={<PersonalFinances />} />
        <Route path="/pericias" element={<GenericModule title="Perícias Judiciais" entity="ExpertReport" />} />
        <Route path="/projetos" element={<GenericModule title="Projetos Complementares" entity="ComplementaryProject" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
