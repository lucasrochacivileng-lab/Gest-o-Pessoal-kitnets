import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Building2, Users, FileText, HandCoins, Receipt, Wallet, HardHat, CreditCard, FolderOpen, Banknote, Gavel, Briefcase, Menu, X, ChevronLeft, Settings } from 'lucide-react';

const menuSections = [
  { title: 'Geral', items: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Visão Geral', icon: BarChart3, path: '/visao-geral' }
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
    { label: 'Configurações', icon: Settings, path: '/configuracoes' }
  ]}
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isActive = (path) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const navContent = (
    <div className="flex h-full flex-col bg-[hsl(222,47%,11%)]">
      <div className="flex items-center justify-between border-b border-white/10 p-5">
        {!collapsed && <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)]"><Building2 className="h-5 w-5 text-white" /></div><div><h1 className="text-base font-semibold leading-tight text-white">KitManager</h1><p className="text-[11px] text-white/50">Gestão Patrimonial</p></div></div>}
        {collapsed && <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)]"><Building2 className="h-5 w-5 text-white" /></div>}
        <button onClick={() => setCollapsed(!collapsed)} className="hidden h-7 w-7 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 lg:flex"><ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} /></button>
        <button onClick={() => setMobileOpen(false)} className="text-white/50 lg:hidden"><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {menuSections.map((section) => <div key={section.title}>{!collapsed && <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">{section.title}</p>}<div className="space-y-1">{section.items.map((item) => <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${isActive(item.path) ? 'bg-[color:color-mix(in_srgb,var(--color-primary)_20%,transparent)] text-[var(--color-primary)]' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}><item.icon className={`h-[18px] w-[18px] flex-shrink-0 ${collapsed ? 'mx-auto' : ''}`} />{!collapsed && <span>{item.label}</span>}</Link>)}</div></div>)}
      </nav>
    </div>
  );

  return <><div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 lg:hidden"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]"><Building2 className="h-4 w-4 text-white" /></div><span className="text-sm font-semibold text-[var(--color-text)]">KitManager</span></div><button onClick={() => setMobileOpen(true)} className="p-2 text-[var(--color-text-muted)]"><Menu className="h-5 w-5" /></button></div>{mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-[var(--color-overlay)]" onClick={() => setMobileOpen(false)} /><div className="absolute left-0 top-0 bottom-0 w-64 bg-[hsl(222,47%,11%)]">{navContent}</div></div>}<aside className={`fixed left-0 top-0 bottom-0 z-30 hidden flex-col bg-[hsl(222,47%,11%)] transition-all duration-300 lg:flex ${collapsed ? 'w-[72px]' : 'w-60'}`}>{navContent}</aside></>;
}
