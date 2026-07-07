import AppProviders from './providers/AppProviders.jsx';
import AppRoutes from './routes/AppRoutes.jsx';

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
