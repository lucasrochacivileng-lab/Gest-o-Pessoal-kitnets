import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '../app/providers/AuthProvider.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    const { error: loginError } = await login(email.trim(), password);

    if (loginError) {
      setError('E-mail ou senha incorretos. Tente novamente.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg,#f1f5f9)] p-4">
      <div className="w-full max-w-[calc(100vw-2rem)] rounded-[var(--radius-2xl)] border border-slate-200 bg-white p-6 shadow-md sm:max-w-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/brand/residencial-rocha.png" alt="Residencial Rocha" className="mb-4 h-auto w-full max-w-[280px]" />
          <p className="text-sm text-slate-500">Acesse a gestão patrimonial</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm text-slate-600">
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="ds-input mt-2 bg-slate-50"
              placeholder="seu@email.com"
            />
          </label>
          <label className="block text-sm text-slate-600">
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              className="ds-input mt-2 bg-slate-50"
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <div className="ds-alert ds-alert-danger">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="ds-btn ds-btn-primary w-full"
          >
            <LogIn className="h-4 w-4" /> {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
