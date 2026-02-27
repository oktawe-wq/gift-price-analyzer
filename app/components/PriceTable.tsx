'use client';

import { useState, useMemo, useId } from 'react';
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  Search, X, Zap, TrendingUp,
} from 'lucide-react';
import rawGifts from '../../data/gifts.json';
import { getCategoryLabel } from '../../utils/taxonomy';

// ── Types ─────────────────────────────────────────────────────────────────

type SortKey = 'title' | 'category' | 'price_min' | 'item_popularity' | 'query_popularity' | 'score' | 'value' | 'analytics';
type SortDir = 'asc' | 'desc';

interface GiftData {
  id:               number;
  title:            string;
  category:         string;
  price_min:        number;
  price_max:        number;
  query:            string;
  query_popularity: number;
  item_popularity:  number;
  score:            number;
  /** Pre-computed taxonomy tag IDs from scripts/categorize.js */
  tags:             string[];
}

interface Row extends GiftData {
  /** score / (price_min / 100) — value-for-money */
  value:     number;
  /** log10(item_popularity) − 1, clamped [0, 5] for star display */
  popRating: number;
  /** Analytics priority: 5 (Стійкий попит) to 1 (Стандартна пропозиція) */
  analyticsPriority: number;
}

// ── Constants ─────────────────────────────────────────────────────────────

const GIFTS: GiftData[] = rawGifts as GiftData[];

const ALL_CATEGORIES = ['All', ...Array.from(new Set(GIFTS.map(g => g.category)))];

const CATEGORY_BADGE: Record<string, string> = {
  'Подарункові набори': 'bg-amber-100  text-amber-800',
  'Патріотичні':        'bg-blue-100   text-blue-800',
  'Чоловікам':          'bg-slate-100  text-slate-700',
  'Жінкам':             'bg-pink-100   text-pink-800',
  'Іграшки':            'bg-green-100  text-green-800',
  'Військовим':         'bg-stone-100  text-stone-700',
};

// Colour per top-level taxonomy group
const TAG_BADGE: Record<string, string> = {
  recipients: 'bg-violet-50  text-violet-700',
  occasions:  'bg-amber-50   text-amber-700',
  type:       'bg-indigo-50  text-indigo-700',
  special:    'bg-emerald-50 text-emerald-700',
};

function tagBadgeClass(catId: string): string {
  const groupId = catId.split('.')[0];
  return TAG_BADGE[groupId] ?? 'bg-slate-100 text-slate-500';
}

// ── Pure helpers ──────────────────────────────────────────────────────────

function calcPop(n: number): number {
  if (!n || n <= 0) return 0;
  return Math.min(5, Math.max(0, Math.log10(n) - 1));
}

function fmtK(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Formats a price range: equal → "₴1 800", spread → "₴1 800–₴2 100" */
function fmtPrice(min: number, max: number): string {
  const fmt = (p: number) => `₴${p.toLocaleString('uk-UA')}`;
  return min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;
}

function popularityBadge(n: number): { label: string; cls: string } | null {
  if (n >= 10_000_000) return { label: 'Топ',       cls: 'bg-emerald-100 text-emerald-800' };
  if (n >= 1_000_000)  return { label: 'Популярне', cls: 'bg-green-100   text-green-800'   };
  if (n >= 100_000)    return { label: 'Відоме',    cls: 'bg-yellow-100  text-yellow-800'  };
  return null;
}

/**
 * Returns the analytics status label for a row.
 * Priority (numeric): Стійкий попит (5) > Обґрунтований вибір (4) > Нішевий фаворит (3) > Висока затребуваність (2) > Стандартна пропозиція (1)
 * valueP85: 85th-percentile value score across the full dataset.
 */
function analyticsStatus(
  row: Row,
  valueP85: number,
): { label: string; cls: string; priority: number } {
  // Priority 5: Стійкий попит
  if (row.score > 9.0 && row.item_popularity > 400)
    return { label: 'Стійкий попит',        cls: 'border-teal-400   text-teal-700',   priority: 5 };
  // Priority 4: Обґрунтований вибір
  if (row.value >= valueP85)
    return { label: 'Обґрунтований вибір',   cls: 'border-slate-400  text-slate-600',  priority: 4 };
  // Priority 3: Нішевий фаворит
  if (row.score > 9.0 && row.item_popularity < 200)
    return { label: 'Нішевий фаворит',       cls: 'border-indigo-400 text-indigo-700', priority: 3 };
  // Priority 2: Висока затребуваність
  if (row.item_popularity > 400)
    return { label: 'Висока затребуваність', cls: 'border-amber-400  text-amber-700',  priority: 2 };
  // Priority 1: Стандартна пропозиція (default fallback)
  return { label: 'Стандартна пропозиція', cls: 'border-slate-300 text-slate-500',   priority: 1 };
}

function scoreColor(s: number) {
  if (s >= 9)   return 'text-emerald-600 font-bold';
  if (s >= 7)   return 'text-green-600';
  if (s >= 5)   return 'text-yellow-600';
  if (s >= 3)   return 'text-orange-500';
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

// ── Build rows ────────────────────────────────────────────────────────────

function buildRows(
  cat: string, search: string,
  sortKey: SortKey, sortDir: SortDir,
  valueP85: number,
): Row[] {
  const needle = search.trim().toLowerCase();
  const isTag  = cat.startsWith('tag:');
  const tagId  = isTag ? cat.slice(4) : null;

  let data: Row[] = GIFTS.map(g => {
    const value = g.price_min > 0 ? (g.score * 100) / g.price_min : 0;
    const popRating = calcPop(g.item_popularity);
    const row: Row = {
      ...g,
      value,
      popRating,
      tags: g.tags ?? [],
      analyticsPriority: 0, // Temporary, will be computed next
    };
    // Compute analytics priority using the same logic as analyticsStatus
    const status = analyticsStatus(row, valueP85);
    row.analyticsPriority = status.priority;
    return row;
  });

  if (isTag && tagId)     data = data.filter(r => r.tags.includes(tagId));
  else if (cat !== 'All') data = data.filter(r => r.category === cat);

  if (needle) data = data.filter(r =>
    r.title.toLowerCase().includes(needle) ||
    r.category.toLowerCase().includes(needle),
  );

  data.sort((a, b) => {
    // Map 'analytics' sort key to 'analyticsPriority' field
    const actualKey = sortKey === 'analytics' ? 'analyticsPriority' : sortKey;
    const av = a[actualKey as keyof Row];
    const bv = b[actualKey as keyof Row];
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
    <span className="text-[13px] tracking-tighter leading-none">
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

  const effectiveCat  = category !== 'All' ? category : categoryFilter;
  const activeSortKey: SortKey = bestValue ? 'value' : sortByPop ? 'item_popularity' : sortKey;
  const activeSortDir: SortDir = (bestValue || sortByPop) ? 'desc' : sortDir;

  // 85th-percentile value threshold — computed once from the full dataset
  const VALUE_P85 = useMemo(() => {
    const vals = GIFTS
      .filter(g => g.price_min > 0)
      .map(g => (g.score * 100) / g.price_min)
      .sort((a, b) => a - b);
    return vals[Math.floor(vals.length * 0.85)] ?? 0;
  }, []);

  const rows: Row[] = useMemo(
    () => buildRows(effectiveCat, search, activeSortKey, activeSortDir, VALUE_P85),
    [effectiveCat, search, activeSortKey, activeSortDir, VALUE_P85],
  );

  const totalForCat = (() => {
    if (effectiveCat === 'All') return GIFTS.length;
    if (effectiveCat.startsWith('tag:')) {
      const tid = effectiveCat.slice(4);
      return GIFTS.filter(g => (g.tags ?? []).includes(tid)).length;
    }
    return GIFTS.filter(g => g.category === effectiveCat).length;
  })();

  // ── Handlers ──────────────────────────────────────────────────────────

  function handleColSort(key: SortKey) {
    setBestValue(false);
    setSortByPop(false);
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'title' || key === 'category' ? 'asc' : 'desc');
    }
  }

  function handleBestValue() {
    if (bestValue) { setBestValue(false); return; }
    setSortByPop(false); setBestValue(true);
    setSortKey('value'); setSortDir('desc');
  }

  function handleSortByPop() {
    if (sortByPop) { setSortByPop(false); return; }
    setBestValue(false); setSortByPop(true);
    setSortKey('item_popularity'); setSortDir('desc');
  }

  // ── Sortable <th> ─────────────────────────────────────────────────────

  function Th({
    label, sub, col, right = false, hl = false, cls = '',
  }: {
    label: string; sub?: string; col: SortKey;
    right?: boolean; hl?: boolean; cls?: string;
  }) {
    const active = activeSortKey === col;
    const Icon   = active
      ? activeSortDir === 'asc' ? ChevronUp : ChevronDown
      : ChevronsUpDown;
    return (
      <th
        onClick={() => handleColSort(col)}
        className={[
          'select-none cursor-pointer px-3 py-2 text-[13px]',
          'font-sans font-bold tracking-wide uppercase',
          'border-b-2 border-slate-600 hover:bg-slate-700 transition-colors',
          right ? 'text-right' : 'text-left',
          active && hl  ? 'bg-indigo-900 text-indigo-200' :
          active        ? 'bg-slate-700  text-white'       :
          hl            ? 'bg-slate-800  text-indigo-400'  :
                          'bg-slate-900  text-slate-400',
          cls,
        ].join(' ')}
      >
        <span className={`inline-flex items-center gap-1 ${right ? 'flex-row-reverse' : ''}`}>
          {label}
          <Icon size={13} className={active ? 'shrink-0' : 'opacity-30 shrink-0'} />
        </span>
        {sub && (
          <span className={`block text-[13px] font-normal tracking-normal normal-case mt-px opacity-60 ${right ? 'text-right' : ''}`}>
            {sub}
          </span>
        )}
      </th>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  // Columns: # | Товар | Ціна | Популярність | Бал | Вигода | Аналітика
  return (
    <div className="flex flex-col gap-3 text-[13px] font-mono antialiased">

      {/* ① Analytics row */}
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
        <p className="text-[13px] text-indigo-700 leading-snug mb-2.5">
          Сортування за показником Вигоди (чим вище — тим вигідніше).
          Колонка «Аналітика» показує статус кожного товару.
        </p>
        <div className="flex flex-wrap gap-2">

          <button
            onClick={handleBestValue}
            aria-pressed={bestValue}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5',
              'rounded-full text-[13px] font-bold border-2',
              'transition-all duration-150 whitespace-nowrap',
              bestValue
                ? 'bg-indigo-600 border-indigo-500 text-white scale-105 shadow-md shadow-indigo-200'
                : 'bg-white border-indigo-300 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-500',
            ].join(' ')}
          >
            <Zap size={14} className={bestValue ? 'text-yellow-300' : 'text-indigo-400'} />
            Сортувати за вигодою
          </button>

          <button
            onClick={handleSortByPop}
            aria-pressed={sortByPop}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5',
              'rounded-full text-[13px] font-bold border-2',
              'transition-all duration-150 whitespace-nowrap',
              sortByPop
                ? 'bg-emerald-600 border-emerald-500 text-white scale-105 shadow-md shadow-emerald-200'
                : 'bg-white border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-500',
            ].join(' ')}
          >
            <TrendingUp size={14} className={sortByPop ? 'text-emerald-200' : 'text-emerald-400'} />
            Сортувати за популярністю
          </button>
        </div>
      </div>

      {/* ② Search + filter row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id={searchId}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Пошук подарунка…"
            className="pl-7 pr-7 py-1.5 text-[13px] w-56 rounded bg-white border border-slate-200 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {category === 'All' && (
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="py-1.5 px-2.5 text-[13px] rounded bg-white border border-slate-200 shadow-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            {ALL_CATEGORIES.map(c => (
              <option key={c} value={c}>{c === 'All' ? 'Всі категорії' : c}</option>
            ))}
          </select>
        )}

        <span className="text-slate-400 tabular-nums">
          {rows.length}<span className="text-slate-500">/{totalForCat}</span>
        </span>
      </div>

      {/* ③ Table */}
      <div
        className="overflow-x-auto overflow-y-auto rounded border border-slate-200 shadow-sm"
        style={{ maxHeight: '80vh', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <table className="w-full border-collapse">

          <thead style={{ position: 'sticky', top: 0, zIndex: 30, background: '#0f172a' }}>
            <tr>
              {/* Rank */}
              <th className="w-10 px-3 py-2 text-center text-[13px] font-sans font-bold tracking-wide uppercase text-slate-500 border-b-2 border-slate-600 select-none">
                #
              </th>
              <Th label="Товар"         col="title"           cls="min-w-[240px]" />
              <Th label="Ціна"          col="price_min"       right cls="min-w-[140px]" />
              <Th
                label="Популярність"
                sub="★ = log₁₀(item) − 1"
                col="item_popularity"
                right
                hl={sortByPop}
                cls="min-w-[180px]"
              />
              <Th label="Бал"   sub="оцінка алгоритму" col="score" right cls="min-w-[80px]" />
              <Th label="Вигода" sub="балів / 1000 грн" col="value" right hl={bestValue} cls="min-w-[90px]" />
              <Th label="Аналітика" sub="пріоритет 5→1" col="analytics" cls="min-w-[180px]" />
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center text-slate-400 text-[13px]">
                  {search
                    ? <>Немає результатів для «<span className="font-medium text-slate-600">{search}</span>»</>
                    : 'У цій категорії немає товарів.'}
                </td>
              </tr>
            ) : rows.map((g, i) => {
              const badge  = popularityBadge(g.item_popularity);
              const status = analyticsStatus(g, VALUE_P85);
              return (
                <tr
                  key={g.id}
                  className={[
                    'transition-colors group hover:bg-indigo-50/60',
                    i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50',
                  ].join(' ')}
                >
                  {/* Rank */}
                  <td className="px-3 py-2 text-center text-[13px] text-slate-400 tabular-nums">{i + 1}</td>

                  {/* Товар — title + category badge + taxonomy chips */}
                  <td className="px-3 py-2 font-medium text-slate-800 max-w-[280px]">
                    <span className="truncate block" title={g.title}>{g.title}</span>
                    <span className="flex flex-wrap gap-0.5 mt-1 items-center">
                      <span className={`text-[13px] font-semibold px-1.5 py-px rounded ${CATEGORY_BADGE[g.category] ?? 'bg-slate-100 text-slate-700'}`}>
                        {g.category}
                      </span>
                      {g.tags.slice(0, 2).map(tid => (
                        <span
                          key={tid}
                          className={`text-[13px] font-semibold px-1.5 py-px rounded ${tagBadgeClass(tid)}`}
                          title={tid}
                        >
                          {getCategoryLabel(tid) ?? tid}
                        </span>
                      ))}
                      {g.tags.length > 2 && (
                        <span className="text-[13px] text-slate-400">+{g.tags.length - 2}</span>
                      )}
                    </span>
                  </td>

                  {/* Ціна */}
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium text-slate-700 group-hover:text-slate-900">
                    {fmtPrice(g.price_min, g.price_max)}
                  </td>

                  {/* Популярність */}
                  <td className={`px-3 py-2 text-right whitespace-nowrap ${sortByPop ? 'bg-emerald-50/60' : ''}`}>
                    <span
                      className="inline-flex flex-col items-end gap-0.5 cursor-help"
                      title={`Індекс взаємодії: ${g.item_popularity.toLocaleString('uk-UA')} · Обсяг пошуку (q): ${g.query_popularity.toLocaleString('uk-UA')}`}
                    >
                      <span className="flex items-center gap-1.5">
                        {badge && (
                          <span className={`text-[13px] font-bold px-1.5 py-px rounded ${badge.cls}`}>
                            {badge.label}
                          </span>
                        )}
                        <StarBar rating={g.popRating} />
                      </span>
                      <span className={`tabular-nums text-[13px] leading-none ${popColor(g.popRating)}`}>
                        {fmtK(g.item_popularity)}
                        {g.query_popularity > 0 && (
                          <span className="text-slate-400 ml-1">· q:{fmtK(g.query_popularity)}</span>
                        )}
                      </span>
                    </span>
                  </td>

                  {/* Бал */}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <span className={`tabular-nums ${scoreColor(g.score)}`}>{g.score.toFixed(1)}</span>
                  </td>

                  {/* Вигода */}
                  <td className={`px-3 py-2 text-right whitespace-nowrap ${bestValue ? 'bg-indigo-50/70' : 'group-hover:bg-indigo-50/40'}`}>
                    <span className={`tabular-nums font-semibold ${valueColor(g.value)}`}>{g.value.toFixed(4)}</span>
                  </td>

                  {/* Аналітика — outline badge */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-block border text-[13px] font-medium px-1.5 py-px rounded ${status.cls}`}>
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 text-[13px] text-slate-500">
                <td colSpan={2} className="px-3 py-1.5 text-slate-400">
                  {rows.length === 1 ? '1 товар'
                    : rows.length <= 4 ? `${rows.length} товари`
                    : `${rows.length} товарів`}
                  {effectiveCat !== 'All' && ` · ${effectiveCat}`}
                  {search && ` · «${search}»`}
                </td>
                {/* Average price in the Ціна column */}
                <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                  сер. {fmtPrice(
                    Math.round(rows.reduce((s, r) => s + r.price_min, 0) / rows.length),
                    Math.round(rows.reduce((s, r) => s + r.price_max, 0) / rows.length),
                  )}
                </td>
                <td /> {/* Популярність */}
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {(rows.reduce((s, r) => s + r.score, 0) / rows.length).toFixed(1)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {(rows.reduce((s, r) => s + r.value, 0) / rows.length).toFixed(4)}
                </td>
                <td /> {/* Аналітика */}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ④ Mathematical legend */}
      <dl className="text-[13px] text-slate-400 px-0.5 leading-relaxed grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
        <div>
          <dt className="inline font-semibold text-slate-500">Бал —</dt>
          {' '}<dd className="inline">Комплексна оцінка пропозиції алгоритмом</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-slate-500">Вигода —</dt>
          {' '}<dd className="inline">Кількість балів якості на кожну 1000 грн вартості</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-slate-500">Популярність —</dt>
          {' '}<dd className="inline">Індекс взаємодії користувачів з товаром</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-slate-500">q: —</dt>
          {' '}<dd className="inline">Загальний обсяг пошукових запитів у ніші</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="inline font-semibold text-slate-500">Клік на заголовок —</dt>
          {' '}<dd className="inline">сортування за Вигодою · чим вище, тим краще</dd>
        </div>
      </dl>
    </div>
  );
}
