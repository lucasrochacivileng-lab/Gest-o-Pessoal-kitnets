import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import DailyInbox from '../modules/notifications/components/DailyInbox.jsx';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <Sidebar />
      {/* Mobile: pt acompanha a barra superior (com safe-area do recorte) e
          pb reserva espaço para a barra inferior de navegação */}
      <main className="pt-[calc(4rem+env(safe-area-inset-top))] lg:ml-60 lg:pt-0">
        <div className="p-4 pb-24 md:p-6 md:pb-24 lg:p-8 lg:pb-8">
          <Outlet />
        </div>
      </main>
      <DailyInbox />
    </div>
  );
}
