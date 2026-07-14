import { Link, Outlet, useLocation } from 'react-router-dom';

// Layout de "hub": uma barra de abas no topo + a tela ativa embaixo (Outlet).
// Envolve rotas que já existem SEM mudar as URLs — cada aba é um Link para a
// rota real, então deep links, botões e notificações continuam funcionando.
// Reduz N itens do menu lateral a UMA entrada, com a navegação fina nas abas.
export default function HubLayout({ tabs }) {
  const { pathname } = useLocation();
  const isActive = (to) => pathname === to || pathname.startsWith(`${to}/`);
  const active = tabs.find((tab) => isActive(tab.to)) || tabs[0];

  return (
    <div className="space-y-5">
      {/* Abas: rolam na horizontal no celular, sem quebrar a tela. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((tab) => {
          const current = active?.to === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                current
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
