import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '../../components/ui/toaster';
import ScrollToTop from '../../components/ScrollToTop.jsx';
import { AuthProvider } from './AuthProvider.jsx';

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        {children}
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  );
}
