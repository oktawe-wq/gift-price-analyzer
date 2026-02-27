'use client';

import { useState, useEffect } from 'react';
import { Menu, Gift, TrendingDown } from 'lucide-react';
import Sidebar from './components/Sidebar';
import PriceTable from './components/PriceTable';
import rawGifts from '../data/gifts.json';

const SESSION_KEY = 'gift_selected_category';

export default function Home() {
  const [category, setCategory]       = useState('All');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Restore the last selected category after hydration (survives remounts /
  // router cache invalidation / tab focus refreshes).
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved && saved !== 'All') setCategory(saved);
  }, []);

  function handleSetCategory(cat: string) {
    setCategory(cat);
    sessionStorage.setItem(SESSION_KEY, cat);
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-mono overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-700 text-white">
        {/* Mobile hamburger */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden text-slate-400 hover:text-white transition-colors"
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <Gift size={16} className="text-indigo-400" />
          <span className="text-[13px] font-bold tracking-tight">Аналізатор Подарунків</span>
        </div>

        {/* Tagline */}
        <div className="hidden sm:flex items-center gap-1.5 ml-2 text-[13px] text-slate-500">
          <TrendingDown size={13} />
          <span>сортування за Вигодою · чим вище, тим краще</span>
        </div>

        {/* Pause badge */}
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 whitespace-nowrap">
          ⏸ Магазин тимчасово на паузі — тільки аналітика
        </span>

        {/* Active category pill */}
        {category !== 'All' && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-800 text-indigo-200">
            {category}
          </span>
        )}
      </header>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <Sidebar
          gifts={rawGifts}
          selected={category}
          onSelect={handleSetCategory}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <PriceTable category={category} />
        </main>
      </div>
    </div>
  );
}
