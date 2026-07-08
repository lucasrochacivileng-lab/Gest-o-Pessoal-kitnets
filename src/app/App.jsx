import AppProviders from './providers/AppProviders.jsx';
import AppRoutes from './routes/AppRoutes.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import { useAuth } from './providers/AuthProvider.jsx';

function AuthGate() {
  const { isAuthenticated, isLoading, requiresLogin } = useAuth();

  if (!requiresLogin) {
    return <AppRoutes />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Carregando...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <AppRoutes />;
}

export default function App() {
  return (
    <AppProviders>
      <AuthGate />
    </AppProviders>
  );
}
