'use client';

import { useState, useMemo, useId } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, X, Zap, TrendingUp } from 'lucide-react';
import rawGifts from '../../data/gifts.json';
import { calculateGiftScore, calculateValue } from '../../utils/engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SortKey = 'name' | 'category' | 'price' | 'stars' | 'score' | 'value' | 'googleResults';
type SortDir = 'asc' | 'desc';

interface GiftData {
  id: number;
  name: string;
  category: string;
  price: number;
  stars: number;
  reviews: number;
  daysSinceAdded: number;
  personalization: boolean;
  stock: boolean;
  googleResults: number;
  url?: string;
}

interface Row extends GiftData {
  score: number;
  value: number;
}

interface PriceTableProps {
  category: string;
}

// ---------------------------------------------------------------------------
// Pre-compute catalogue-wide max reviews (engine denominator)
// ---------------------------------------------------------------------------
const GIFTS: GiftData[] = rawGifts as GiftData[];
const MAX_REVIEWS = Math.max(...GIFTS.map(g => g.reviews));
const ALL_CATEGORIES = ['All', ...Array.from(new Set(GIFTS.map(g => g.category)))];

// ---------------------------------------------------------------------------
// Category badge colours
// ---------------------------------------------------------------------------
const CATEGORY_BADGE: Record<string, string> = {
  'Мини бары': 'bg-amber-100  text-amber-800',
  'Брелки':    'bg-violet-100 text-violet-800',
  'Кубки':     'bg-yellow-100 text-yellow-800',
  'Игры':      'bg-blue-100   text-blue-800',
};

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
function scoreColor(s: number): string {
  if (s >= 1.5) return 'text-emerald-600 font-bold';
  if (s >= 1.0) return 'text-green-600';
  if (s >= 0.7) return 'text-yellow-600';
  if (s >= 0.4) return 'text-orange-500';
  return 'text-red-500';
}

function valueColor(v: number): string {
  if (v >= 0.5) return 'text-emerald-600 font-bold';
  if (v >= 0.2) return 'text-green-600';
  if (v >= 0.1) return 'text-yellow-600';
  if (v >= 0.04) return 'text-orange-500';
  return 'text-red-500';
}

// Popularity rating: Rating = log10(googleResults) - 1, clamped to [0, 5]
// Scale: 100 results ≈ 1★ · 10 000 ≈ 3★ · 1 000 000 ≈ 5★
function popularityRating(googleResults: number): number {
  if (!googleResults || googleResults <= 0) return 0;
  return Math.min(5, Math.max(0, Math.log10(googleResults) - 1));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SortIcon({ col, active, dir }: { col: SortKey; active: boolean; dir: SortDir }) {
  void col;
  if (!active) return <ChevronsUpDown size={10} className="opacity-30 shrink-0" />;
  return dir === 'asc'
    ? <ChevronUp   size={10} className="shrink-0" />
    : <ChevronDown size={10} className="shrink-0" />;
}

function StarDisplay({ rating }: { rating: number }) {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <span className="text-amber-400 tracking-tighter">
      {'★'.repeat(full)}
      {half ? '½' : ''}
      <span className="text-gray-300">{'★'.repeat(empty)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PriceTable({ category }: PriceTableProps) {
  const searchId = useId();
  const [sortKey,          setSortKey]          = useState<SortKey>('value');
  const [sortDir,          setSortDir]          = useState<SortDir>('desc');
  const [search,           setSearch]           = useState('');
  const [bestValue,        setBestValue]        = useState(false);
  const [sortByPopularity, setSortByPopularity] = useState(false);
  // Internal category dropdown — only active when the sidebar shows "All"
  const [categoryFilter,   setCategoryFilter]   = useState('All');

  function toggleSort(key: SortKey) {
    if (bestValue)        setBestValue(false);
    if (sortByPopularity) setSortByPopularity(false);
    if (sortKey === key && !bestValue && !sortByPopularity) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'category' ? 'asc' : 'desc');
    }
  }

  function toggleBestValue() {
    setSortByPopularity(false);
    setBestValue(on => {
      if (!on) { setSortKey('value'); setSortDir('desc'); }
      return !on;
    });
  }

  function toggleSortByPopularity() {
    setBestValue(false);
    setSortByPopularity(on => {
      if (!on) { setSortKey('googleResults'); setSortDir('desc'); }
      return !on;
    });
  }

  // When sidebar has already chosen a category, the dropdown is hidden and
  // the sidebar selection takes precedence.
  const effectiveCat = category !== 'All' ? category : categoryFilter;

  // ── Build + filter + sort rows ──────────────────────────────────────────
  const rows: Row[] = useMemo(() => {
    const needle = search.trim().toLowerCase();

    let data: Row[] = GIFTS.map(g => {
      const { score } = calculateGiftScore({
        stars:          g.stars,
        daysSinceAdded: g.daysSinceAdded,
        reviews:        g.reviews,
        maxReviews:     MAX_REVIEWS,
        price:          g.price,
      });
      return { ...g, score, value: calculateValue(score, g.price) };
    });

    if (effectiveCat !== 'All')
      data = data.filter(g => g.category === effectiveCat);

    if (needle)
      data = data.filter(g =>
        g.name.toLowerCase().includes(needle) ||
        g.category.toLowerCase().includes(needle),
      );

    const key = bestValue        ? 'value'         :
                sortByPopularity ? 'googleResults'  : sortKey;
    const dir = (bestValue || sortByPopularity) ? 'desc' : sortDir;

    data.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'string' && typeof bv === 'string')
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return dir === 'asc'
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });

    return data;
  }, [sortKey, sortDir, bestValue, sortByPopularity, effectiveCat, search]);

  const totalForCategory = effectiveCat === 'All'
    ? GIFTS.length
    : GIFTS.filter(g => g.category === effectiveCat).length;

  const effectiveSortKey = bestValue        ? 'value'        :
                           sortByPopularity ? 'googleResults' : sortKey;
  const effectiveSortDir = (bestValue || sortByPopularity) ? 'desc' : sortDir;

  // Reusable sortable <th>
  function Th({ label, subLabel, col, align = 'left', highlight = false, className = '' }: {
    label: string; subLabel?: string; col: SortKey; align?: 'left' | 'right';
    highlight?: boolean; className?: string;
  }) {
    const active = effectiveSortKey === col;
    return (
      <th
        onClick={() => toggleSort(col)}
        className={`
          select-none cursor-pointer
          px-2 py-1.5 text-[10px] font-sans font-bold tracking-widest uppercase
          border-b-2 border-slate-600
          hover:bg-slate-700 transition-colors
          ${active && highlight ? 'bg-indigo-900 text-indigo-200' :
            active              ? 'bg-slate-700  text-white'       :
            highlight           ? 'bg-slate-900  text-indigo-400'  :
                                  'bg-slate-900  text-slate-400'}
          text-${align} ${className}
        `}
      >
        <span className={`inline-flex items-center gap-0.5 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          {label}
          <SortIcon col={col} active={active} dir={effectiveSortDir} />
        </span>
        {subLabel && (
          <span className={`block text-[8px] font-normal tracking-normal normal-case mt-px opacity-70 ${align === 'right' ? 'text-right' : 'text-left'}`}>
            {subLabel}
          </span>
        )}
      </th>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 text-[11px] font-mono antialiased">

      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">

        {/* Search */}
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id={searchId}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Пошук подарунка…"
            className="
              pl-6 pr-6 py-1 text-[11px] w-52 rounded
              bg-white border border-slate-200 shadow-sm
              placeholder:text-slate-400
              focus:outline-none focus:ring-1 focus:ring-slate-400
            "
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
            className="
              py-1 px-2 text-[11px] rounded
              bg-white border border-slate-200 shadow-sm
              text-slate-700
              focus:outline-none focus:ring-1 focus:ring-slate-400
            "
          >
            {ALL_CATEGORIES.map(c => (
              <option key={c} value={c}>{c === 'All' ? 'Всі категорії' : c}</option>
            ))}
          </select>
        )}

        {/* Count */}
        <span className="text-slate-400 tabular-nums">
          {rows.length}<span className="text-slate-600">/{totalForCategory}</span>
        </span>

        {/* Formula hint */}
        <div className="ml-auto hidden sm:flex items-center gap-1 text-[10px] text-slate-400">
          <span>Вигода = Score / (ціна/100)</span>
        </div>
      </div>

      {/* ── Info alert ────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-[11px]">
        <span className="mt-0.5 text-blue-500 shrink-0 text-base leading-none">ℹ</span>
        <div>
          <p className="font-semibold text-blue-800 mb-0.5">Як працює розумний пошук?</p>
          <p className="text-blue-700 leading-snug">
            Ми аналізуємо кожен подарунок за формулою Diskprices: чим вища <strong>«Вигода»</strong>, тим краще
            співвідношення ціни, рейтингу та свіжості товару.
          </p>
        </div>
      </div>

      {/* ── Analytics ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-[11px]">
        <p className="text-indigo-700 leading-snug flex-1">
          Використовуйте аналітику для пошуку найвигідніших пропозицій за ціною та популярністю в мережі.
        </p>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {/* Sort by benefit */}
          <button
            onClick={toggleBestValue}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold
              border-2 transition-all duration-150 shadow-sm whitespace-nowrap
              ${bestValue
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-200 shadow-md scale-105'
                : 'bg-white border-indigo-300 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-500 hover:shadow-md'}
            `}
            aria-pressed={bestValue}
          >
            <Zap size={13} className={bestValue ? 'text-yellow-300' : 'text-indigo-400'} />
            Сортувати за вигодою
          </button>

          {/* Sort by popularity */}
          <button
            onClick={toggleSortByPopularity}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold
              border-2 transition-all duration-150 shadow-sm whitespace-nowrap
              ${sortByPopularity
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-200 shadow-md scale-105'
                : 'bg-white border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-500 hover:shadow-md'}
            `}
            aria-pressed={sortByPopularity}
          >
            <TrendingUp size={13} className={sortByPopularity ? 'text-emerald-200' : 'text-emerald-400'} />
            Сортувати за популярністю
          </button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div
        className="overflow-x-auto overflow-y-auto max-h-[80vh] rounded border border-slate-200 shadow-sm"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <table className="w-full border-collapse">

          <thead className="sticky top-0 z-30 bg-slate-900">
            <tr>
              {/* Rank */}
              <th className="
                w-8 px-2 py-1.5 text-center text-[10px]
                font-sans font-bold tracking-widest uppercase text-slate-500
                bg-slate-900 border-b-2 border-slate-600 select-none
              ">
                #
              </th>
              <Th label="Назва"         col="name"          align="left"  className="min-w-[200px]" />
              <Th label="Категорія"     col="category"      align="left"  className="min-w-[110px]" />
              {/* Stock — not sortable */}
              <th className="
                px-2 py-1.5 text-center text-[10px]
                font-sans font-bold tracking-widest uppercase text-slate-400
                bg-slate-900 border-b-2 border-slate-600 select-none whitespace-nowrap min-w-[75px]
              ">
                Наявність
              </th>
              <Th label="Ціна"          col="price"         align="right" className="min-w-[75px]" />
              <Th label="Рейтинг"       col="stars"         align="right" className="min-w-[95px]" />
              <Th
                label="Популярність"
                subLabel="(Google, ★ = log₁₀ − 1)"
                col="googleResults"
                align="right"
                highlight={sortByPopularity}
                className="min-w-[140px]"
              />
              <Th label="Бал"    subLabel="(Якість + Новизна)" col="score" align="right" className="min-w-[85px]" />
              <Th label="Вигода" subLabel="(Бал / Ціна)"       col="value" align="right" highlight={bestValue} className="min-w-[80px]" />
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  {search
                    ? <>Немає результатів для &laquo;<span className="font-medium text-slate-600">{search}</span>&raquo;</>
                    : 'У цій категорії немає товарів.'}
                </td>
              </tr>
            ) : (
              rows.map((g, i) => {
                const popRating = popularityRating(g.googleResults);
                const popFull   = Math.floor(popRating);
                const popHalf   = popRating - popFull >= 0.5 ? 1 : 0;
                const popEmpty  = 5 - popFull - popHalf;

                return (
                  <tr
                    key={g.id}
                    className={`
                      transition-colors group hover:bg-indigo-50/60
                      ${i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}
                      ${!g.stock ? 'opacity-40' : ''}
                    `}
                  >
                    {/* Rank */}
                    <td className="px-2 py-1 text-center text-[10px] text-slate-400 tabular-nums">
                      {i + 1}
                    </td>

                    {/* Name + personalization hint */}
                    <td className="px-2 py-1 font-medium text-slate-800 max-w-[220px]">
                      <a
                        href={g.url ?? `https://podaroktut.com.ua/search?q=${encodeURIComponent(g.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate block text-blue-600 underline hover:text-blue-800"
                        title={g.name}
                      >
                        {g.name}
                      </a>
                      {g.personalization && (
                        <span className="text-[9px] text-indigo-400 font-normal">✎ персоналізація</span>
                      )}
                    </td>

                    {/* Category badge */}
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className={`
                        inline-block px-1 py-px rounded text-[10px] font-semibold leading-tight
                        ${CATEGORY_BADGE[g.category] ?? 'bg-slate-100 text-slate-700'}
                      `}>
                        {g.category}
                      </span>
                    </td>

                    {/* Stock dot */}
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

                    {/* Stars (product rating) */}
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      <span className="inline-flex items-center justify-end gap-1">
                        <StarDisplay rating={g.stars} />
                        <span className="text-slate-500 tabular-nums">{g.stars.toFixed(1)}</span>
                      </span>
                    </td>

                    {/* Popularity — log10-based stars, tooltip shows raw Google count */}
                    <td className={`px-2 py-1 text-right whitespace-nowrap ${sortByPopularity ? 'bg-emerald-50/70' : ''}`}>
                      <span
                        className="inline-flex items-center justify-end gap-1 cursor-help"
                        title={`${g.googleResults.toLocaleString('uk-UA')} результатів у Google`}
                      >
                        <span className="text-amber-400 tracking-tighter text-[10px]">
                          {'★'.repeat(popFull)}
                          {popHalf ? '½' : ''}
                          <span className="text-gray-300">{'★'.repeat(popEmpty)}</span>
                        </span>
                        <span className="text-slate-400 tabular-nums text-[9px]">
                          {popRating.toFixed(1)}
                        </span>
                      </span>
                    </td>

                    {/* Score */}
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      <span className={`tabular-nums ${scoreColor(g.score)}`}>
                        {g.score.toFixed(3)}
                      </span>
                    </td>

                    {/* Value — highlighted when toggle is on */}
                    <td className={`px-2 py-1 text-right whitespace-nowrap ${bestValue ? 'bg-indigo-50/70' : 'group-hover:bg-indigo-50/40'}`}>
                      <span className={`tabular-nums font-semibold ${valueColor(g.value)}`}>
                        {g.value.toFixed(4)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* ── Footer averages ──────────────────────────────────── */}
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500">
                <td colSpan={6} className="px-2 py-1 text-slate-400">
                  {rows.length === 1 ? '1 товар' : rows.length >= 2 && rows.length <= 4 ? `${rows.length} товари` : `${rows.length} товарів`}
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

      <p className="text-[10px] text-slate-400 px-0.5">
        Score = R×0.4 + N×0.35 + Pop×0.25 / log₂(ціна) ·
        Вигода = Score / (ціна/100) ·
        Популярність = log₁₀(Google) − 1 ·
        більше = краща пропозиція ·
        товари не в наявності затемнені ·
        натисніть заголовок колонки для сортування ·{' '}
        <span className="text-slate-500">v1.5.0</span>
      </p>
    </div>
  );
}
