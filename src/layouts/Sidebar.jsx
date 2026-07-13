import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Building2, Users, FileText, HandCoins, Receipt, Wallet, HardHat, CreditCard, FolderOpen, Banknote, Gavel, Briefcase, Menu, X, ChevronLeft, Settings, Bell, LogOut, CalendarRange, PieChart, ArrowLeftRight, Layers, Landmark } from 'lucide-react';
import { useAuth } from '../app/providers/AuthProvider.jsx';

const menuSections = [
  { title: 'Geral', items: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Visão Geral', icon: BarChart3, path: '/visao-geral' },
    { label: 'Consolidado', icon: Layers, path: '/consolidado' },
    { label: 'Resultado por kitnet', icon: Building2, path: '/resultado-kitnets' },
    { label: 'Extrato', icon: ArrowLeftRight, path: '/extrato' },
    { label: 'Caixa e conciliação', icon: Landmark, path: '/caixa' },
    { label: 'Previsão', icon: CalendarRange, path: '/previsao' },
    { label: 'Gastos por categoria', icon: PieChart, path: '/gastos-categoria' }
  ]},
  { title: 'Kitnets', items: [
    { label: 'Kitnets', icon: Building2, path: '/kitnets' },
    { label: 'Locatários', icon: Users, path: '/locatarios' },
    { label: 'Contratos', icon: FileText, path: '/contratos' },
    { label: 'Recebimentos', icon: HandCoins, path: '/recebimentos' },
    { label: 'Pagamentos', icon: Receipt, path: '/pagamentos' },
    { label: 'Despesas', icon: Wallet, path: '/despesas' },
    { label: 'Obra', icon: HardHat, path: '/obra' },
    { label: 'Cartões', icon: CreditCard, path: '/cartoes' },
    { label: 'Documentos', icon: FolderOpen, path: '/documentos' },
    { label: 'Relatórios', icon: FileText, path: '/relatorios' }
  ]},
  { title: 'Pessoal & Profissional', items: [
    { label: 'Finanças Pessoais', icon: Banknote, path: '/financas-pessoais' },
    { label: 'Perícias', icon: Gavel, path: '/pericias' },
    { label: 'Projetos', icon: Briefcase, path: '/projetos' }
  ]},
  { title: 'Sistema', items: [
    { label: 'Notificações', icon: Bell, path: '/notificacoes' },
    { label: 'Configurações', icon: Settings, path: '/configuracoes' }
  ]}
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, logout, requiresLogin } = useAuth();
  const isActive = (path) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const userName = user?.email === 'lucasrocha.civileng@gmail.com' ? 'Lucas' : (user?.email?.split('@')[0] || 'Usuário');

  const navContent = (
    <div className="flex h-full flex-col bg-[hsl(222,47%,11%)]">
      <div className="flex items-center justify-between border-b border-white/10 p-5">
        {!collapsed && <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)]"><Building2 className="h-5 w-5 text-white" /></div><div><h1 className="text-base font-semibold leading-tight text-white">Gestão Residencial Rocha</h1><p className="text-[11px] text-white/50">Gestão Patrimonial</p></div></div>}
        {collapsed && <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)]"><Building2 className="h-5 w-5 text-white" /></div>}
        <button onClick={() => setCollapsed(!collapsed)} className="hidden h-7 w-7 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 lg:flex"><ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} /></button>
        <button onClick={() => setMobileOpen(false)} className="text-white/50 lg:hidden"><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {menuSections.map((section) => <div key={section.title}>{!collapsed && <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">{section.title}</p>}<div className="space-y-1">{section.items.map((item) => <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${isActive(item.path) ? 'bg-[color:color-mix(in_srgb,var(--color-primary)_20%,transparent)] text-[var(--color-primary)]' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}><item.icon className={`h-[18px] w-[18px] flex-shrink-0 ${collapsed ? 'mx-auto' : ''}`} />{!collapsed && <span>{item.label}</span>}</Link>)}</div></div>)}
      </nav>
      {requiresLogin ? (
        <div className="border-t border-white/10 p-4">
          {!collapsed && <div className="mb-2"><p className="text-sm font-medium text-white">{userName}</p><p className="text-[11px] text-white/50">Administrador</p></div>}
          <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white">
            <LogOut className={`h-4 w-4 ${collapsed ? 'mx-auto' : ''}`} />{!collapsed && 'Sair'}
          </button>
        </div>
      ) : null}
    </div>
  );

  // Atalhos da barra inferior (celular): as 4 telas do dia a dia + menu completo.
  const bottomNavItems = [
    { label: 'Início', icon: LayoutDashboard, path: '/' },
    { label: 'Receber', icon: HandCoins, path: '/recebimentos' },
    { label: 'Contratos', icon: FileText, path: '/contratos' },
    { label: 'Kitnets', icon: Building2, path: '/kitnets' },
  ];

  return <>
    {/* Barra superior (celular): safe-area para o recorte/status bar do PWA */}
    <div className="fixed inset-x-0 top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-surface)] pt-[env(safe-area-inset-top)] lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]"><Building2 className="h-4 w-4 text-white" /></div><span className="text-sm font-semibold text-[var(--color-text)]">Gestão Residencial Rocha</span></div>
        <button onClick={() => setMobileOpen(true)} aria-label="Abrir menu completo" className="-mr-2 p-3 text-[var(--color-text-muted)]"><Menu className="h-5 w-5" /></button>
      </div>
    </div>

    {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-[var(--color-overlay)]" onClick={() => setMobileOpen(false)} /><div className="absolute left-0 top-0 bottom-0 w-64 bg-[hsl(222,47%,11%)] pt-[env(safe-area-inset-top)]">{navContent}</div></div>}

    {/* Barra inferior de navegação (celular): estilo app nativo */}
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {bottomNavItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}
            >
              <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? 'bg-[color:color-mix(in_srgb,var(--color-primary)_14%,transparent)]' : ''}`}>
                <item.icon className="h-5 w-5" />
              </span>
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium text-[var(--color-text-muted)] transition-colors"
        >
          <span className="flex h-7 w-12 items-center justify-center rounded-full">
            <Menu className="h-5 w-5" />
          </span>
          Menu
        </button>
      </div>
    </nav>

    <aside className={`fixed left-0 top-0 bottom-0 z-30 hidden flex-col bg-[hsl(222,47%,11%)] transition-all duration-300 lg:flex ${collapsed ? 'w-[72px]' : 'w-60'}`}>{navContent}</aside>
  </>;
}
