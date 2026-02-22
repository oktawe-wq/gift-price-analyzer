'use client';

import { useState, useMemo, useId } from 'react';
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  Search, X, Zap, TrendingUp,
} from 'lucide-react';
import rawGifts from '../../data/gifts.json';
import { calculateGiftScore, calculateValue } from '../../utils/engine';

// ── Types ─────────────────────────────────────────────────────────────────
type SortKey = 'name' | 'category' | 'price' | 'googleResults' | 'score' | 'value';
type SortDir = 'asc' | 'desc';

interface GiftData {
  id:              number;
  name:            string;
  category:        string;
  price:           number;
  stars:           number;        // used by score engine; NOT shown as a column
  reviews:         number;
  daysSinceAdded:  number;
  personalization: boolean;
  stock:           boolean;
  googleResults:   number;
  url?:            string;
}

interface Row extends GiftData {
  score:     number;
  value:     number;
  popRating: number;  // log10(googleResults) - 1, clamped [0,5]
}

// ── Constants ─────────────────────────────────────────────────────────────
const GIFTS: GiftData[]  = rawGifts as GiftData[];
const MAX_REVIEWS        = Math.max(1, ...GIFTS.map(g => g.reviews));
const ALL_CATEGORIES     = ['All', ...Array.from(new Set(GIFTS.map(g => g.category)))];

const CATEGORY_BADGE: Record<string, string> = {
  'Мини бары': 'bg-amber-100  text-amber-800',
  'Брелки':    'bg-violet-100 text-violet-800',
  'Кубки':     'bg-yellow-100 text-yellow-800',
  'Игры':      'bg-blue-100   text-blue-800',
};

// ── Pure functions (defined outside component — stable references) ─────────
// Popularity: log10(googleResults) - 1, clamped [0, 5]
// Scale: 100 → 1★ | 10 000 → 3★ | 1 000 000 → 5★
function calcPop(n: number): number {
  if (!n || n <= 0) return 0;
  return Math.min(5, Math.max(0, Math.log10(n) - 1));
}

// Compact number: 5670 → "5.7k"  |  412000 → "412k"  |  850 → "850"
function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function scoreColor(s: number) {
  if (s >= 1.5) return 'text-emerald-600 font-bold';
  if (s >= 1.0) return 'text-green-600';
  if (s >= 0.7) return 'text-yellow-600';
  if (s >= 0.4) return 'text-orange-500';
  return 'text-red-500';
}
function valueColor(v: number) {
  if (v >= 0.5)  return 'text-emerald-600 font-bold';
  if (v >= 0.2)  return 'text-green-600';
  if (v >= 0.1)  return 'text-yellow-600';
  if (v >= 0.04) return 'text-orange-500';
  return 'text-red-500';
}
function popColor(r: number) {
  if (r >= 4.0) return 'text-emerald-600';
  if (r >= 3.0) return 'text-green-600';
  if (r >= 2.0) return 'text-yellow-600';
  if (r >= 1.0) return 'text-orange-500';
  return 'text-red-400';
}

// Pre-compute rows outside component so useMemo gets stable input
function buildRows(
  cat: string, search: string,
  sortKey: SortKey, sortDir: SortDir,
): Row[] {
  const needle = search.trim().toLowerCase();

  let data: Row[] = GIFTS.map(g => {
    const raw = calculateGiftScore({
      stars:          g.stars,
      daysSinceAdded: g.daysSinceAdded,
      reviews:        g.reviews,
      maxReviews:     MAX_REVIEWS,
      price:          g.price,
    });
    // Fallback benefit: if score rounds to 0 (price 0 or no data) use 10 % of price
    const score = raw.score > 0 ? raw.score : (g.price > 0 ? g.price * 0.10 : 0);
    return {
      ...g,
      score,
      value:     calculateValue(score, g.price),
      popRating: calcPop(g.googleResults),
    };
  });

  if (cat !== 'All') data = data.filter(r => r.category === cat);
  if (needle)        data = data.filter(r =>
    r.name.toLowerCase().includes(needle) ||
    r.category.toLowerCase().includes(needle),
  );

  data.sort((a, b) => {
    const av = a[sortKey as keyof Row];
    const bv = b[sortKey as keyof Row];
    if (typeof av === 'string' && typeof bv === 'string')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc'
      ? (av as number) - (bv as number)
      : (bv as number) - (av as number);
  });

  return data;
}

// ── StarBar ───────────────────────────────────────────────────────────────
function StarBar({ rating }: { rating: number }) {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <span className="text-[11px] tracking-tighter leading-none">
      <span className="text-amber-400">{'★'.repeat(full)}{half ? '½' : ''}</span>
      <span className="text-gray-300">{'★'.repeat(empty)}</span>
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────
export default function PriceTable({ category }: { category: string }) {
  const searchId = useId();

  const [sortKey,        setSortKey]        = useState<SortKey>('value');
  const [sortDir,        setSortDir]        = useState<SortDir>('desc');
  const [search,         setSearch]         = useState('');
  const [bestValue,      setBestValue]      = useState(false);
  const [sortByPop,      setSortByPop]      = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Sidebar category wins over dropdown
  const effectiveCat = category !== 'All' ? category : categoryFilter;

  // Active sort params (quick-sort toggles override column sort)
  const activeSortKey: SortKey = bestValue ? 'value' : sortByPop ? 'googleResults' : sortKey;
  const activeSortDir: SortDir = (bestValue || sortByPop) ? 'desc' : sortDir;

  // All heavy work inside useMemo — re-runs only when deps change
  const rows: Row[] = useMemo(
    () => buildRows(effectiveCat, search, activeSortKey, activeSortDir),
    [effectiveCat, search, activeSortKey, activeSortDir],
  );

  const totalForCat = effectiveCat === 'All'
    ? GIFTS.length
    : GIFTS.filter(g => g.category === effectiveCat).length;

  // ── Handlers ────────────────────────────────────────────────────────────
  function handleColSort(key: SortKey) {
    setBestValue(false);
    setSortByPop(false);
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'category' ? 'asc' : 'desc');
    }
  }

  function handleBestValue() {
    if (bestValue) { setBestValue(false); return; }
    setSortByPop(false);
    setBestValue(true);
    setSortKey('value');
    setSortDir('desc');
  }

  function handleSortByPop() {
    if (sortByPop) { setSortByPop(false); return; }
    setBestValue(false);
    setSortByPop(true);
    setSortKey('googleResults');
    setSortDir('desc');
  }

  // ── Sortable <th> (defined inside to close over sort state) ─────────────
  function Th({
    label, sub, col, right = false, hl = false, cls = '',
  }: {
    label: string; sub?: string; col: SortKey;
    right?: boolean; hl?: boolean; cls?: string;
  }) {
    const active = activeSortKey === col;
    const Icon = active
      ? activeSortDir === 'asc' ? ChevronUp : ChevronDown
      : ChevronsUpDown;
    return (
      <th
        onClick={() => handleColSort(col)}
        className={[
          'select-none cursor-pointer px-2 py-2 text-[10px]',
          'font-sans font-bold tracking-widest uppercase',
          'border-b-2 border-slate-600 hover:bg-slate-700 transition-colors',
          right ? 'text-right' : 'text-left',
          active && hl  ? 'bg-indigo-900 text-indigo-200'  :
          active        ? 'bg-slate-700  text-white'         :
          hl            ? 'bg-slate-800  text-indigo-400'    :
                          'bg-slate-900  text-slate-400',
          cls,
        ].join(' ')}
      >
        <span className={`inline-flex items-center gap-0.5 ${right ? 'flex-row-reverse' : ''}`}>
          {label}
          <Icon size={10} className={active ? 'shrink-0' : 'opacity-30 shrink-0'} />
        </span>
        {sub && (
          <span className={`block text-[8px] font-normal tracking-normal normal-case mt-px opacity-60 ${right ? 'text-right' : ''}`}>
            {sub}
          </span>
        )}
      </th>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2.5 text-[11px] font-mono antialiased">

      {/* ① Analytics — above everything ─────────────────────────── */}
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5">
        <p className="text-[11px] text-indigo-700 leading-snug mb-2">
          Використовуйте аналітику для пошуку найвигідніших пропозицій
          за ціною та популярністю в мережі.
        </p>
        <div className="flex flex-wrap gap-2">

          <button
            onClick={handleBestValue}
            aria-pressed={bestValue}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5',
              'rounded-full text-[12px] font-bold border-2',
              'transition-all duration-150 whitespace-nowrap',
              bestValue
                ? 'bg-indigo-600 border-indigo-500 text-white scale-105 shadow-md shadow-indigo-200'
                : 'bg-white border-indigo-300 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-500',
            ].join(' ')}
          >
            <Zap size={13} className={bestValue ? 'text-yellow-300' : 'text-indigo-400'} />
            Сортувати за вигодою
          </button>

          <button
            onClick={handleSortByPop}
            aria-pressed={sortByPop}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5',
              'rounded-full text-[12px] font-bold border-2',
              'transition-all duration-150 whitespace-nowrap',
              sortByPop
                ? 'bg-emerald-600 border-emerald-500 text-white scale-105 shadow-md shadow-emerald-200'
                : 'bg-white border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-500',
            ].join(' ')}
          >
            <TrendingUp size={13} className={sortByPop ? 'text-emerald-200' : 'text-emerald-400'} />
            Сортувати за популярністю
          </button>
        </div>
      </div>

      {/* ② Search + Category filter ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">

        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id={searchId}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Пошук подарунка…"
            className="pl-6 pr-6 py-1 text-[11px] w-52 rounded bg-white border border-slate-200 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X size={10} />
            </button>
          )}
        </div>

        {/* Category dropdown — hidden when sidebar already filters */}
        {category === 'All' && (
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="py-1 px-2 text-[11px] rounded bg-white border border-slate-200 shadow-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            {ALL_CATEGORIES.map(c => (
              <option key={c} value={c}>{c === 'All' ? 'Всі категорії' : c}</option>
            ))}
          </select>
        )}

        <span className="text-slate-400 tabular-nums">
          {rows.length}<span className="text-slate-500">/{totalForCat}</span>
        </span>

        <span className="ml-auto hidden sm:inline text-[10px] text-slate-400">
          Вигода = Score / (ціна/100)
        </span>
      </div>

      {/* ③ Table ─────────────────────────────────────────────────── */}
      <div
        className="overflow-x-auto overflow-y-auto rounded border border-slate-200 shadow-sm"
        style={{ maxHeight: '80vh', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <table className="w-full border-collapse">

          {/* Sticky header — solid inline bg so nothing bleeds through */}
          <thead style={{ position: 'sticky', top: 0, zIndex: 30, background: '#0f172a' }}>
            <tr>
              <th className="w-8 px-2 py-2 text-center text-[10px] font-sans font-bold tracking-widest uppercase text-slate-500 border-b-2 border-slate-600 select-none">
                #
              </th>
              <Th label="Назва"     col="name"          cls="min-w-[200px]" />
              <Th label="Категорія" col="category"      cls="min-w-[110px]" />
              <th className="px-2 py-2 text-center text-[10px] font-sans font-bold tracking-widest uppercase text-slate-400 border-b-2 border-slate-600 select-none min-w-[55px]">
                Наявн.
              </th>
              <Th label="Ціна"  col="price" right cls="min-w-[75px]" />

              {/* ← single merged Popularity column; no old stars column */}
              <Th
                label="Популярність (Google)"
                sub="★ = log₁₀(results) − 1"
                col="googleResults"
                right
                hl={sortByPop}
                cls="min-w-[160px]"
              />

              <Th label="Бал"    sub="якість × новизна"   col="score" right cls="min-w-[80px]" />
              <Th label="Вигода" sub="бал / (ціна / 100)"  col="value" right hl={bestValue} cls="min-w-[85px]" />
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  {search
                    ? <>Немає результатів для «<span className="font-medium text-slate-600">{search}</span>»</>
                    : 'У цій категорії немає товарів.'}
                </td>
              </tr>
            ) : rows.map((g, i) => (
              <tr
                key={g.id}
                className={[
                  'transition-colors group hover:bg-indigo-50/60',
                  i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50',
                  !g.stock ? 'opacity-40' : '',
                ].join(' ')}
              >
                {/* Rank */}
                <td className="px-2 py-1 text-center text-[10px] text-slate-400 tabular-nums">{i + 1}</td>

                {/* Name */}
                <td className="px-2 py-1 font-medium text-slate-800 max-w-[220px]">
                  <a
                    href={g.url ?? `https://podaroktut.com.ua/search?q=${encodeURIComponent(g.name)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="truncate block text-blue-600 underline hover:text-blue-800"
                    title={g.name}
                  >
                    {g.name}
                  </a>
                  {g.personalization && (
                    <span className="text-[9px] text-indigo-400 font-normal">✎ персоналізація</span>
                  )}
                </td>

                {/* Category */}
                <td className="px-2 py-1 whitespace-nowrap">
                  <span className={`inline-block px-1 py-px rounded text-[10px] font-semibold leading-tight ${CATEGORY_BADGE[g.category] ?? 'bg-slate-100 text-slate-700'}`}>
                    {g.category}
                  </span>
                </td>

                {/* Stock */}
                <td className="px-2 py-1 text-center">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${g.stock ? 'bg-emerald-500' : 'bg-red-400'}`}
                    title={g.stock ? 'В наявності' : 'Немає в наявності'}
                  />
                </td>

                {/* Price */}
                <td className="px-2 py-1 text-right tabular-nums text-slate-700 whitespace-nowrap font-medium group-hover:text-slate-900">
                  ₴{g.price.toLocaleString('uk-UA')}
                </td>

                {/* Popularity — stars + compact number; tooltip = full count */}
                <td className={`px-2 py-1 text-right whitespace-nowrap ${sortByPop ? 'bg-emerald-50/60' : ''}`}>
                  <span
                    className="inline-flex flex-col items-end gap-0 cursor-help"
                    title={`${g.googleResults.toLocaleString('uk-UA')} результатів у Google`}
                  >
                    <StarBar rating={g.popRating} />
                    <span className={`tabular-nums text-[9px] leading-none mt-0.5 ${popColor(g.popRating)}`}>
                      {fmtK(g.googleResults)}
                    </span>
                  </span>
                </td>

                {/* Score */}
                <td className="px-2 py-1 text-right whitespace-nowrap">
                  <span className={`tabular-nums ${scoreColor(g.score)}`}>{g.score.toFixed(3)}</span>
                </td>

                {/* Value */}
                <td className={`px-2 py-1 text-right whitespace-nowrap ${bestValue ? 'bg-indigo-50/70' : 'group-hover:bg-indigo-50/40'}`}>
                  <span className={`tabular-nums font-semibold ${valueColor(g.value)}`}>{g.value.toFixed(4)}</span>
                </td>
              </tr>
            ))}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500">
                <td colSpan={5} className="px-2 py-1 text-slate-400">
                  {rows.length === 1 ? '1 товар'
                    : rows.length <= 4 ? `${rows.length} товари`
                    : `${rows.length} товарів`}
                  {effectiveCat !== 'All' && ` · ${effectiveCat}`}
                  {search && ` · «${search}»`}
                </td>
                <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                  сер. ₴{Math.round(rows.reduce((s, r) => s + r.price, 0) / rows.length).toLocaleString('uk-UA')}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {(rows.reduce((s, r) => s + r.score, 0) / rows.length).toFixed(3)}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {(rows.reduce((s, r) => s + r.value, 0) / rows.length).toFixed(4)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Legend */}
      <p className="text-[10px] text-slate-400 px-0.5 leading-relaxed">
        Бал = (R×0.4 + N×0.35 + Pop×0.25) / log₂(ціна) ·
        Вигода = Бал / (ціна/100) ·
        Популярність = log₁₀(Google) − 1 ·
        товари без наявності затемнені ·
        клік на заголовок = сортування ·{' '}
        <span className="text-slate-500">v1.5.0</span>
      </p>
    </div>
  );
}
