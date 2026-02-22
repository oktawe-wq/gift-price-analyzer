'use client';

import {
  LayoutGrid,
  GlassWater,
  Key,
  Trophy,
  Gamepad2,
  X,
  type LucideIcon,
} from 'lucide-react';

interface GiftItem {
  id: number;
  category: string;
}

interface SidebarProps {
  gifts: GiftItem[];
  selected: string;
  onSelect: (category: string) => void;
  open: boolean;
  onClose: () => void;
}

// Must match category names in data/gifts.json
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  All:         LayoutGrid,
  'Мини бары': GlassWater,
  'Брелки':    Key,
  'Кубки':     Trophy,
  'Игры':      Gamepad2,
};

const CATEGORY_ICON_COLOR: Record<string, string> = {
  'Мини бары': 'text-amber-400',
  'Брелки':    'text-violet-400',
  'Кубки':     'text-yellow-400',
  'Игры':      'text-blue-400',
};

const CATEGORY_ORDER = ['All', 'Мини бары', 'Брелки', 'Кубки', 'Игры'];

const CATEGORY_LABELS: Record<string, string> = {
  'All':       'Усі товари',
  'Мини бары': 'Мини бары',
  'Брелки':    'Брелки',
  'Кубки':     'Кубки',
  'Игры':      'Игры',
};

export default function Sidebar({ gifts, selected, onSelect, open, onClose }: SidebarProps) {
  const counts = gifts.reduce<Record<string, number>>((acc, g) => {
    acc[g.category] = (acc[g.category] ?? 0) + 1;
    return acc;
  }, {});

  function handleSelect(cat: string) {
    onSelect(cat);
    onClose();
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside className={`
        fixed top-0 left-0 z-30 h-full w-48 flex flex-col
        bg-slate-900 border-r border-slate-800
        transform transition-transform duration-200 ease-in-out
        lg:static lg:translate-x-0 lg:z-auto lg:shrink-0
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800">
          <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500">
            Категорії
          </span>
          <button
            onClick={onClose}
            className="lg:hidden p-0.5 text-slate-600 hover:text-slate-300 transition-colors"
            aria-label="Закрити"
          >
            <X size={14} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-1">
          {CATEGORY_ORDER.map(cat => {
            const Icon    = CATEGORY_ICONS[cat] ?? LayoutGrid;
            const count   = cat === 'All' ? gifts.length : (counts[cat] ?? 0);
            const active  = selected === cat;
            const icolor  = CATEGORY_ICON_COLOR[cat] ?? 'text-slate-500';

            return (
              <button
                key={cat}
                onClick={() => handleSelect(cat)}
                className={`
                  w-full flex items-center gap-2 px-3 py-1.5 text-left
                  font-mono text-[11px] transition-colors duration-100
                  ${active
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }
                `}
              >
                <Icon
                  size={13}
                  className={`shrink-0 ${active ? 'text-white' : icolor}`}
                />
                <span className="flex-1 truncate">{CATEGORY_LABELS[cat] ?? cat}</span>
                <span className={`
                  shrink-0 min-w-[20px] text-center text-[10px] tabular-nums
                  rounded px-1
                  ${active ? 'bg-slate-600 text-slate-200' : 'text-slate-600'}
                `}>
                  {count}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-slate-800 text-[10px] text-slate-600 font-mono">
          {gifts.length} товарів · ₴ УАН
        </div>
      </aside>
    </>
  );
}
