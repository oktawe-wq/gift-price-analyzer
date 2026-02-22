'use client';

import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import rawGifts from '../data/gifts.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SortKey = 'name' | 'category' | 'price' | 'rating' | 'valueIndex';
type SortDir = 'asc' | 'desc';

interface Gift {
  id: number;
  emoji: string;
  name: string;
  category: string;
  price: number;   // UAH
  rating: number;  // 1.0 – 5.0
}

interface GiftRow extends Gift {
  valueIndex: number; // price / rating (lower = better value)
}

interface GiftTableProps {
  category: string; // controlled by sidebar
}

const GIFTS: Gift[] = rawGifts;

// ---------------------------------------------------------------------------
// Category colour palette
// ---------------------------------------------------------------------------
const CATEGORY_STYLES: Record<string, string> = {
  'Home Decor':             'bg-amber-100  text-amber-800',
  'Beauty & Wellness':      'bg-pink-100   text-pink-800',
  'Food & Gourmet':         'bg-orange-100 text-orange-800',
  'Toys & Games':           'bg-purple-100 text-purple-800',
  'Electronics & Gadgets':  'bg-blue-100   text-blue-800',
  'Jewelry & Accessories':  'bg-yellow-100 text-yellow-800',
  'Books & Stationery':     'bg-green-100  text-green-800',
  "Kids' Gifts":            'bg-rose-100   text-rose-800',
  'Personalized Gifts':     'bg-indigo-100 text-indigo-800',
  'Sports & Outdoors':      'bg-teal-100   text-teal-800',
};

function categoryStyle(cat: string) {
  return CATEGORY_STYLES[cat] ?? 'bg-gray-100 text-gray-700';
}

// ---------------------------------------------------------------------------
// Value Index colouring — lower is better (like price/TB on diskprices.com)
// ---------------------------------------------------------------------------
function viStyle(vi: number): string {
  if (vi < 80)  return 'text-emerald-600 font-bold';
  if (vi < 150) return 'text-green-600';
  if (vi < 250) return 'text-yellow-600';
  if (vi < 400) return 'text-orange-500';
  return 'text-red-500 font-semibold';
}

function viLabel(vi: number): string {
  if (vi < 80)  return '★ great';
  if (vi < 150) return '▲ good';
  if (vi < 250) return '● fair';
  if (vi < 400) return '▼ poor';
  return '✕ weak';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function Stars({ rating }: { rating: number }) {
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

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-0.5 text-gray-500 opacity-40">⇅</span>;
  return <span className="ml-0.5">{dir === 'asc' ? '↑' : '↓'}</span>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function GiftTable({ category }: GiftTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('valueIndex');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch]   = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const hasFilters = search || maxPrice || minRating;

  const rows: GiftRow[] = useMemo(() => {
    let data: GiftRow[] = GIFTS.map(g => ({
      ...g,
      valueIndex: Math.round((g.price / g.rating) * 10) / 10,
    }));

    if (category !== 'All')
      data = data.filter(g => g.category === category);
    if (search.trim())
      data = data.filter(g =>
        g.name.toLowerCase().includes(search.trim().toLowerCase()),
      );
    if (maxPrice !== '' && !isNaN(Number(maxPrice)))
      data = data.filter(g => g.price <= Number(maxPrice));
    if (minRating !== '' && !isNaN(Number(minRating)))
      data = data.filter(g => g.rating >= Number(minRating));

    data.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string')
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc'
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });

    return data;
  }, [sortKey, sortDir, category, search, maxPrice, minRating]);

  const colHeader = (label: string, key: SortKey, align: 'left' | 'right' = 'left') => (
    <th
      onClick={() => handleSort(key)}
      className={`
        px-3 py-2.5 text-${align} cursor-pointer select-none whitespace-nowrap
        hover:bg-slate-600 active:bg-slate-500 transition-colors
      `}
    >
      {label}
      <SortArrow active={sortKey === key} dir={sortDir} />
    </th>
  );

  return (
    <div className="font-mono text-xs antialiased">

      {/* ── Filter toolbar ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm">
        <SlidersHorizontal size={13} className="text-slate-400 shrink-0" />

        {/* Search */}
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-slate-200 rounded pl-6 pr-2 py-1 w-44 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50"
          />
        </div>

        {/* Max price */}
        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 whitespace-nowrap">Max ₴</label>
          <input
            type="number"
            min={0}
            placeholder="any"
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 w-24 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50"
          />
        </div>

        {/* Min rating */}
        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 whitespace-nowrap">Min ★</label>
          <input
            type="number"
            min={1}
            max={5}
            step={0.1}
            placeholder="any"
            value={minRating}
            onChange={e => setMinRating(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 w-20 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50"
          />
        </div>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setMaxPrice(''); setMinRating(''); }}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X size={11} /> clear
          </button>
        )}

        {/* Item count */}
        <span className="ml-auto text-slate-400 tabular-nums">
          {rows.length} / {category === 'All' ? GIFTS.length : GIFTS.filter(g => g.category === category).length} items
        </span>
      </div>

      {/* ── Value Index legend ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 px-1 text-[11px] text-slate-500">
        <span>Value Index = Price ÷ Rating · lower is better</span>
        <span className="text-emerald-600 font-bold">★ great &lt;80</span>
        <span className="text-green-600">▲ good &lt;150</span>
        <span className="text-yellow-600">● fair &lt;250</span>
        <span className="text-orange-500">▼ poor &lt;400</span>
        <span className="text-red-500">✕ weak ≥400</span>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
        <table className="w-full border-collapse text-xs">

          <thead>
            <tr className="bg-slate-700 text-slate-100 text-left text-[11px] tracking-wide">
              <th className="px-3 py-2.5 w-12 text-center text-slate-400 font-normal">IMG</th>
              {colHeader('PRODUCT NAME', 'name')}
              {colHeader('CATEGORY', 'category')}
              {colHeader('PRICE (₴)', 'price', 'right')}
              {colHeader('RATING', 'rating', 'right')}
              {colHeader('VALUE INDEX', 'valueIndex', 'right')}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  No products match your filters.
                </td>
              </tr>
            ) : (
              rows.map((g, i) => (
                <tr
                  key={g.id}
                  className={`
                    border-b border-slate-100 last:border-0
                    hover:bg-blue-50 transition-colors
                    ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}
                  `}
                >
                  {/* Emoji thumbnail */}
                  <td className="px-3 py-1.5 text-center">
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded bg-slate-100 text-base leading-none"
                      title={g.name}
                    >
                      {g.emoji}
                    </span>
                  </td>

                  {/* Product name */}
                  <td className="px-3 py-1.5 font-medium text-slate-800 whitespace-nowrap">
                    {g.name}
                  </td>

                  {/* Category badge */}
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${categoryStyle(g.category)}`}>
                      {g.category}
                    </span>
                  </td>

                  {/* Price */}
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                    ₴{g.price.toLocaleString('uk-UA')}
                  </td>

                  {/* Rating */}
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-1.5">
                      <Stars rating={g.rating} />
                      <span className="text-slate-600">{g.rating.toFixed(1)}</span>
                    </div>
                  </td>

                  {/* Value Index */}
                  <td className={`px-3 py-1.5 text-right tabular-nums ${viStyle(g.valueIndex)}`}>
                    <span className="mr-1.5 text-[10px] opacity-70">{viLabel(g.valueIndex)}</span>
                    {g.valueIndex.toFixed(1)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <p className="mt-2 px-1 text-[11px] text-slate-400">
        Prices in Ukrainian hryvnia (₴). Categories modelled after podaroktut.com.ua.
        Click any column header to sort.
      </p>
    </div>
  );
}
