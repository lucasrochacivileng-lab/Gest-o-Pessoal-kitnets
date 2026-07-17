import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  ChevronLeft,
  CreditCard,
  FileSignature,
  FolderOpen,
  Gavel,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  Users,
  Wallet,
  Wand2,
  X,
} from 'lucide-react';
import { useAuth } from '../app/providers/AuthProvider.jsx';

const menuSections = [
  { title: 'Início', items: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  ] },
  { title: 'Dinheiro', items: [
    {
      label: 'Financeiro',
      icon: Wallet,
      path: '/receitas',
      match: ['/receitas', '/caixa-entrada', '/recebimentos', '/despesas', '/pagamentos', '/extrato', '/caixa', '/financas-pessoais'],
    },
    {
      label: 'Relatórios',
      icon: BarChart3,
      path: '/visao-geral',
      match: ['/visao-geral', '/consolidado', '/resultado-kitnets', '/gastos-categoria', '/previsao', '/relatorios'],
    },
  ] },
  { title: 'Imóveis', items: [
    { label: 'Kitnets', icon: Building2, path: '/kitnets' },
    {
      label: 'Locações',
      icon: Users,
      path: '/locacoes',
      match: ['/locacoes', '/locatarios', '/contratos'],
    },
  ] },
  { title: 'Trabalho', items: [
    { label: 'Perícias', icon: Gavel, path: '/pericias' },
    { label: 'Projetos', icon: Briefcase, path: '/projetos' },
  ] },
  { title: 'Ajustes', items: [
    { label: 'Cartões', icon: CreditCard, path: '/cartoes' },
    { label: 'Regras de classificação', icon: Wand2, path: '/regras-classificacao' },
    { label: 'Documentos', icon: FolderOpen, path: '/documentos' },
    { label: 'Notificações', icon: Bell, path: '/notificacoes' },
    { label: 'Preferências e backup', icon: Settings, path: '/configuracoes' },
  ] },
];

const quickActions = [
  {
    label: 'Adicionar receita',
    description: 'Aluguel, salário, perícia ou projeto',
    icon: ArrowUpCircle,
    path: '/receitas?novo=1',
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    label: 'Adicionar despesa',
    description: 'Pessoal, kitnet, projeto ou perícia',
    icon: ArrowDownCircle,
    path: '/despesas?novo=1',
    tone: 'bg-rose-50 text-rose-700',
  },
  {
    label: 'Nova locação',
    description: 'Locatário, contrato e documentos',
    icon: FileSignature,
    path: '/locacoes?novo=1',
    tone: 'bg-blue-50 text-blue-700',
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const location = useLocation();
  const { user, logout, requiresLogin } = useAuth();
  const isActive = (path) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));
  const isItemActive = (item) => (item.match
    ? item.match.some((prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`))
    : isActive(item.path));
  const userName = user?.email === 'lucasrocha.civileng@gmail.com' ? 'Lucas' : (user?.email?.split('@')[0] || 'Usuário');

  const navContent = (
    <div className="flex h-full flex-col bg-[hsl(222,47%,11%)]">
      <div className="flex items-center justify-between border-b border-white/10 p-5">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <img src="/brand/residencial-rocha-mark.png" alt="" className="h-9 w-9 rounded-lg object-cover" />
            <div><h1 className="text-base font-semibold leading-tight text-white">Residencial Rocha</h1><p className="text-[11px] text-white/50">Gestão patrimonial</p></div>
          </div>
        ) : <img src="/brand/residencial-rocha-mark.png" alt="Residencial Rocha" className="mx-auto h-9 w-9 rounded-lg object-cover" />}
        <button type="button" onClick={() => setCollapsed(!collapsed)} className="hidden h-7 w-7 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 lg:flex" aria-label="Recolher menu"><ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} /></button>
        <button type="button" onClick={() => setMobileOpen(false)} className="text-white/50 lg:hidden" aria-label="Fechar menu"><X className="h-5 w-5" /></button>
      </div>

      <div className="px-3 pt-3">
        <button type="button" onClick={() => setQuickOpen(true)} className={`flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 ${collapsed ? 'px-0' : ''}`}>
          <Plus className="h-5 w-5" />{!collapsed ? 'Lançar' : null}
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {menuSections.map((section) => (
          <div key={section.title}>
            {!collapsed ? <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-normal text-white/30">{section.title}</p> : null}
            <div className="space-y-1">
              {section.items.map((item) => (
                <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isItemActive(item) ? 'bg-[color:color-mix(in_srgb,var(--color-primary)_20%,transparent)] text-[var(--color-primary)]' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
                  <item.icon className={`h-[18px] w-[18px] flex-shrink-0 ${collapsed ? 'mx-auto' : ''}`} />{!collapsed ? <span>{item.label}</span> : null}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {requiresLogin ? (
        <div className="border-t border-white/10 p-4">
          {!collapsed ? <div className="mb-2"><p className="text-sm font-medium text-white">{userName}</p><p className="text-[11px] text-white/50">Administrador</p></div> : null}
          <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"><LogOut className={`h-4 w-4 ${collapsed ? 'mx-auto' : ''}`} />{!collapsed ? 'Sair' : null}</button>
        </div>
      ) : null}
    </div>
  );

  const bottomNavItems = [
    { label: 'Início', icon: LayoutDashboard, path: '/' },
    { label: 'Financeiro', icon: Wallet, path: '/receitas', match: ['/receitas', '/caixa-entrada', '/recebimentos', '/despesas', '/pagamentos', '/extrato', '/caixa', '/financas-pessoais'] },
    { label: 'Imóveis', icon: Building2, path: '/kitnets', match: ['/kitnets', '/locacoes', '/locatarios', '/contratos'] },
  ];

  return <>
    <div className="fixed inset-x-0 top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-surface)] pt-[env(safe-area-inset-top)] lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2"><img src="/brand/residencial-rocha-mark.png" alt="" className="h-8 w-8 rounded-lg object-cover" /><span className="text-sm font-semibold text-[var(--color-text)]">Residencial Rocha</span></div>
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu completo" className="-mr-2 p-3 text-[var(--color-text-muted)]"><Menu className="h-5 w-5" /></button>
      </div>
    </div>

    {mobileOpen ? <div className="fixed inset-0 z-[60] lg:hidden"><button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-[var(--color-overlay)]" onClick={() => setMobileOpen(false)} /><div className="absolute bottom-0 left-0 top-0 w-[min(19rem,86vw)] bg-[hsl(222,47%,11%)] pt-[env(safe-area-inset-top)] shadow-2xl">{navContent}</div></div> : null}

    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5 px-1">
        <MobileNavLink item={bottomNavItems[0]} active={isItemActive(bottomNavItems[0])} />
        <MobileNavLink item={bottomNavItems[1]} active={isItemActive(bottomNavItems[1])} />
        <button type="button" onClick={() => setQuickOpen(true)} className="relative flex min-h-16 flex-col items-center justify-end gap-0.5 pb-1.5 text-[11px] font-semibold text-[var(--color-primary)]" aria-label="Lançar">
          <span className="absolute -top-5 flex h-14 w-14 items-center justify-center rounded-full border-4 border-[var(--color-bg)] bg-[var(--color-primary)] text-white shadow-lg"><Plus className="h-7 w-7" /></span>
          Lançar
        </button>
        <MobileNavLink item={bottomNavItems[2]} active={isItemActive(bottomNavItems[2])} />
        <button type="button" onClick={() => setMobileOpen(true)} className="flex min-h-16 flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-[var(--color-text-muted)]"><span className="flex h-7 w-12 items-center justify-center rounded-full"><Menu className="h-5 w-5" /></span>Mais</button>
      </div>
    </nav>

    {quickOpen ? (
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-4">
        <button type="button" aria-label="Fechar lançamentos" className="absolute inset-0" onClick={() => setQuickOpen(false)} />
        <div className="relative w-full max-w-md rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[var(--radius-lg)] sm:p-5">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-slate-900">O que deseja lançar?</h2><p className="text-sm text-slate-500">Escolha uma ação para continuar.</p></div><button type="button" onClick={() => setQuickOpen(false)} className="rounded-lg border border-slate-200 p-2 text-slate-500" aria-label="Fechar"><X className="h-5 w-5" /></button></div>
          <div className="space-y-2">
            {quickActions.map((action) => <Link key={action.path} to={action.path} onClick={() => setQuickOpen(false)} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/40"><span className={`flex h-11 w-11 items-center justify-center rounded-lg ${action.tone}`}><action.icon className="h-5 w-5" /></span><span><span className="block text-sm font-semibold text-slate-900">{action.label}</span><span className="block text-xs text-slate-500">{action.description}</span></span></Link>)}
          </div>
        </div>
      </div>
    ) : null}

    <aside className={`fixed bottom-0 left-0 top-0 z-30 hidden flex-col bg-[hsl(222,47%,11%)] transition-all duration-300 lg:flex ${collapsed ? 'w-[72px]' : 'w-60'}`}>{navContent}</aside>
  </>;
}

function MobileNavLink({ item, active }) {
  return (
    <Link to={item.path} className={`flex min-h-16 flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-medium transition-colors ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
      <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? 'bg-[color:color-mix(in_srgb,var(--color-primary)_14%,transparent)]' : ''}`}><item.icon className="h-5 w-5" /></span>
      {item.label}
    </Link>
  );
}
