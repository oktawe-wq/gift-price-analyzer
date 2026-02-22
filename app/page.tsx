'use client';

import { useState } from 'react';
import { Menu, Gift, TrendingDown } from 'lucide-react';
import Sidebar from './components/Sidebar';
import PriceTable from './components/PriceTable';
import rawGifts from '../data/gifts.json';

export default function Home() {
  // entry point
  const [category, setCategory]       = useState('All');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          <span className="text-sm font-bold tracking-tight">Gift Price Analyzer</span>
        </div>

        {/* Tagline */}
        <div className="hidden sm:flex items-center gap-1.5 ml-2 text-[11px] text-slate-500">
          <TrendingDown size={11} />
          <span>sorted by Value Score · higher = better deal</span>
        </div>

        {/* Active category pill */}
        {category !== 'All' && (
          <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-indigo-800 text-indigo-200">
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
          onSelect={setCategory}
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
