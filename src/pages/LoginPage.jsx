import { useState } from 'react';
import { Building2, LogIn } from 'lucide-react';
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
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary,#2563eb)]">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Gestão Residencial Rocha</h1>
          <p className="mt-1 text-sm text-slate-500">Entre para acessar seus dados</p>
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
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
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
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" /> {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
