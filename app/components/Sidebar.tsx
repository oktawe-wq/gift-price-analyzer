'use client';

import { useState, useEffect } from 'react';
import { LayoutGrid, ChevronDown, X } from 'lucide-react';
import { TAXONOMY, getGroupForCategory } from '../../utils/taxonomy';

// ── Types ─────────────────────────────────────────────────────────────────

interface GiftItem {
  id:       number;
  title:    string;
  category: string;
  tags:     string[];
}

interface SidebarProps {
  gifts:    GiftItem[];
  selected: string;
  onSelect: (category: string) => void;
  open:     boolean;
  onClose:  () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function Sidebar({ gifts, selected, onSelect, open, onClose }: SidebarProps) {

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  // Auto-expand the group containing the active tag filter
  useEffect(() => {
    if (!selected.startsWith('tag:')) return;
    const tagId = selected.slice(4);
    const group = getGroupForCategory(tagId);
    if (group) {
      setOpenGroups(prev => {
        if (prev.has(group.id)) return prev;
        const next = new Set(prev);
        next.add(group.id);
        return next;
      });
    }
  }, [selected]);

  function toggleGroup(groupId: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function handleSelect(cat: string) {
    onSelect(cat);
    onClose();
  }

  function countForCat(catId: string): number {
    return gifts.filter(g => g.tags?.includes(catId)).length;
  }

  function countForGroup(groupId: string): number {
    const group = TAXONOMY.find(g => g.id === groupId);
    if (!group) return 0;
    const seen = new Set<number>();
    for (const cat of group.categories) {
      gifts.forEach((g, i) => { if (g.tags?.includes(cat.id)) seen.add(i); });
    }
    return seen.size;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={onClose} />
      )}

      {/* stopPropagation on the aside prevents any click inside the sidebar
          from ever reaching the fixed inset-0 backdrop overlay */}
      <aside
        onClick={e => e.stopPropagation()}
        className={[
          'fixed top-0 left-0 z-30 h-full w-60 flex flex-col',
          'bg-slate-900 border-r border-slate-800',
          'transform transition-transform duration-200 ease-in-out',
          'lg:static lg:translate-x-0 lg:z-auto lg:shrink-0',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <span className="text-[11px] font-bold tracking-widest uppercase text-slate-500">
            Категорії
          </span>
          <button
            onClick={onClose}
            className="lg:hidden p-1 text-slate-600 hover:text-slate-300 transition-colors"
            aria-label="Закрити"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-1.5 space-y-px">

          {/* All button */}
          <button
            onClick={() => handleSelect('All')}
            className={[
              'w-full flex items-center gap-2.5 px-4 py-2',
              'font-mono text-[13px] transition-colors',
              selected === 'All'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
            ].join(' ')}
          >
            <LayoutGrid size={15} className="shrink-0 text-slate-500" />
            <span className="flex-1">Усі товари</span>
            <CountBadge n={gifts.length} active={selected === 'All'} />
          </button>

          <div className="mx-4 border-t border-slate-800" />

          {/* Accordion groups */}
          {TAXONOMY.map(group => {
            const isOpen     = openGroups.has(group.id);
            const groupCount = countForGroup(group.id);
            const hasActive  = selected.startsWith('tag:') &&
              group.categories.some(cat => selected === `tag:${cat.id}`);

            return (
              <div key={group.id}>

                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  className={[
                    'w-full flex items-center gap-2 px-4 py-2',
                    'font-mono text-[13px] transition-colors select-none',
                    hasActive
                      ? 'text-slate-100 bg-slate-800'
                      : isOpen
                        ? 'text-slate-300 bg-slate-800/50'
                        : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-300',
                  ].join(' ')}
                >
                  <span className="text-[14px] leading-none shrink-0">{group.emoji}</span>
                  <span className="flex-1 text-left font-semibold truncate">{group.label}</span>
                  <span className="text-[13px] tabular-nums text-slate-600 mr-1">{groupCount}</span>
                  <ChevronDown
                    size={13}
                    className={[
                      'shrink-0 text-slate-600 transition-transform duration-200',
                      isOpen ? 'rotate-180' : '',
                    ].join(' ')}
                  />
                </button>

                {/* Subcategory list */}
                {isOpen && (
                  /* stopPropagation here ensures clicking empty space in the
                     accordion list never bubbles to the group-header button
                     or the backdrop overlay */
                  <ul
                    className="border-l border-slate-800 ml-5 my-0.5 space-y-px"
                    onClick={e => e.stopPropagation()}
                  >
                    {group.categories.map(cat => {
                      const count    = countForCat(cat.id);
                      if (count === 0) return null;

                      const catKey   = `tag:${cat.id}`;
                      const isActive = selected === catKey;

                      return (
                        <li key={cat.id}>
                          <button
                            onClick={e => { e.stopPropagation(); handleSelect(catKey); }}
                            className={[
                              'w-full flex items-center gap-2 pl-3 pr-3 py-1.5',
                              'font-mono text-[13px] transition-colors text-left',
                              isActive
                                ? 'bg-indigo-800/70 text-indigo-100 rounded-sm'
                                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 rounded-sm',
                            ].join(' ')}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-indigo-300' : 'bg-slate-600'}`} />
                            <span className="flex-1 truncate leading-snug">{cat.label}</span>
                            <CountBadge n={count} active={isActive} small />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

              </div>
            );
          })}

        </nav>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-800 text-[13px] text-slate-600 font-mono shrink-0">
          {gifts.length} товарів · ₴ UAH
        </div>

      </aside>
    </>
  );
}

// ── CountBadge ────────────────────────────────────────────────────────────

function CountBadge({ n, active, small = false }: { n: number; active: boolean; small?: boolean }) {
  return (
    <span className={[
      'shrink-0 tabular-nums rounded px-1.5 text-right',
      'text-[13px]',
      active ? 'bg-slate-600 text-slate-200' : 'text-slate-600',
    ].join(' ')}>
      {n}
    </span>
  );
}
