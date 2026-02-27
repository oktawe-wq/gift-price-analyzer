/**
 * utils/taxonomy.ts
 *
 * 4-level gift taxonomy based on HIERARCHY.md.
 * Used by Sidebar (display + counts), PriceTable (filtering + tag chips),
 * and scripts/categorize.js (data pre-processing).
 *
 * Every pattern is tested against:
 *   (item.title + " " + item.query).toLowerCase()
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface TaxonomyCategory {
  /** Dot-separated ID, e.g. "recipients.men" */
  id: string;
  /** Ukrainian label shown in Sidebar and tag chips */
  label: string;
  /** Tested against lowercased (title + " " + query) */
  pattern: RegExp;
}

export interface TaxonomyGroup {
  /** Top-level ID, e.g. "recipients" */
  id: string;
  label: string;
  emoji: string;
  categories: TaxonomyCategory[];
}

// ── Full 4-level taxonomy ─────────────────────────────────────────────────

export const TAXONOMY: TaxonomyGroup[] = [

  // ── 1. ОТРИМУВАЧІ (Recipients) ──────────────────────────────────────────
  {
    id:    'recipients',
    label: 'Отримувачі',
    emoji: '👥',
    categories: [
      {
        id:      'recipients.men',
        label:   'Чоловікам',
        // чоловіку, хлопцю, мужчині, другу, сину, брату, татові
        pattern: /чоловік|хлопц|мужч|другу\b|сину\b|брату\b|тато/ui,
      },
      {
        id:      'recipients.women',
        label:   'Жінкам',
        // жінці, дівчині, дружині, подрузі, дочці, матусі
        pattern: /жінк|дівчин|дружин|подруз|дочц|матус|коханій/ui,
      },
      {
        id:      'recipients.colleagues',
        label:   'Колегам та Керівництву',
        // колезі, шефу, начальнику, керівнику, корпоративне
        pattern: /колег|шефу|начальник|керівник|корпоратив/ui,
      },
      {
        id:      'recipients.military',
        label:   'Військовим',
        // військовому, ЗСУ, армія, захисник, бойовий
        pattern: /військов|зсу\b|армі|захисник|бойов/ui,
      },
      {
        id:      'recipients.children',
        label:   'Дітям та Підліткам',
        // дітям, дівчаткам, хлопчикам, підліткам, школярам, дитині
        pattern: /дітям|дівчатк|хлопчик|підлітк|школяр|дитин|дітей/ui,
      },
      {
        id:      'recipients.special',
        label:   'Спеціальні',
        // одногрупнику, у якого все є, іноземцям (патріотичні)
        pattern: /одногрупник|у якого все є|іноземц/ui,
      },
    ],
  },

  // ── 2. ПОВОДИ ТА ПОДІЇ (Occasions) ─────────────────────────────────────
  {
    id:    'occasions',
    label: 'Поводи та події',
    emoji: '🎉',
    categories: [
      {
        id:      'occasions.birthday',
        label:   'День народження',
        pattern: /день народження|на народження|іменини/ui,
      },
      {
        id:      'occasions.anniversary',
        label:   'Ювілеї (12–60 років)',
        // "12 років", "18 рок", ювілей, повноліття
        pattern: /\b(12|18|20|25|30|31|40|41|48|50|60)\s*рок|\bювілей\b|повноліт/ui,
      },
      {
        id:      'occasions.new_year',
        label:   'Новий рік',
        pattern: /новий рік|новорічн/ui,
      },
      {
        id:      'occasions.holiday',
        label:   'Свята',
        // 14 лютого, День закоханих, Святого Миколая, День захисника
        pattern: /14 лютого|закоханих|валентин|миколая|захисника/ui,
      },
      {
        id:      'occasions.memory',
        label:   'На пам\'ять / Річниця',
        pattern: /на пам.ять|річниц|при звільненн/ui,
      },
    ],
  },

  // ── 3. ТИП ПОДАРУНКА (Gift type / character) ────────────────────────────
  {
    id:    'type',
    label: 'Тип подарунка',
    emoji: '🎁',
    categories: [
      {
        id:      'type.premium',
        label:   'Елітні та Статусні',
        // елітні, ексклюзивні, VIP, статусні, брендові, дорогі, розкіш
        pattern: /елітн|ексклюзивн|vip|статусн|брендов|дорог|розкіш/ui,
      },
      {
        id:      'type.original',
        label:   'Оригінальні / Креативні',
        pattern: /оригінальн|незвичайн|креативн|унікальн|цікав/ui,
      },
      {
        id:      'type.funny',
        label:   'Прикольні / З гумором',
        pattern: /приколь|з гумором|прикол|смішн/ui,
      },
      {
        id:      'type.experience',
        label:   'Подарунки-враження',
        // враження, емоції, сертифікат
        pattern: /враження|емоці|сертифікат/ui,
      },
      {
        id:      'type.set',
        label:   'Готові набори',
        // набір, бокс, box, набор
        pattern: /набір|бокс\b|box\b|набор/ui,
      },
      {
        id:      'type.patriotic',
        label:   'Патріотичні',
        // патріот, символіка, вишиванка, тризуб
        // NOTE: "україн" intentionally excluded here — too broad, matched by data category
        pattern: /патріот|символік|вишиванк|тризуб/ui,
      },
      {
        id:      'type.practical',
        label:   'Практичні',
        pattern: /практичн|корисн|в машину|тактичн/ui,
      },
      {
        id:      'type.tech',
        label:   'Техніка та Гаджети',
        // гаджет, техніка, смарт-годинник, навушники
        pattern: /гаджет|техніка|смарт.годинник|навушник/ui,
      },
    ],
  },

  // ── 4. СПЕЦИФІЧНІ ЗАПИТИ (Special search filters) ───────────────────────
  {
    id:    'special',
    label: 'Специфічні запити',
    emoji: '🔍',
    categories: [
      {
        id:      'special.trends',
        label:   'Тренди 2026',
        pattern: /2026|тренд|новинк/ui,
      },
      {
        id:      'special.wishlist',
        label:   'Що попросити (Wishlist)',
        pattern: /що попросити|список бажань|wishlist/ui,
      },
      {
        id:      'special.branded',
        label:   'Брендові',
        pattern: /бренд/ui,
      },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Returns all taxonomy category IDs that match the given title + query.
 * Called by scripts/categorize.js and can be used at render time as fallback.
 */
export function classifyItem(title: string, query: string): string[] {
  const text = (title + ' ' + (query ?? '')).toLowerCase();
  const tags: string[] = [];
  for (const group of TAXONOMY) {
    for (const cat of group.categories) {
      if (cat.pattern.test(text)) tags.push(cat.id);
    }
  }
  return tags;
}

/** Returns the human-readable label for a category ID, e.g. "recipients.men" → "Чоловікам". */
export function getCategoryLabel(id: string): string | undefined {
  for (const group of TAXONOMY) {
    const cat = group.categories.find(c => c.id === id);
    if (cat) return cat.label;
  }
  return undefined;
}

/** Returns the TaxonomyGroup that owns the given category ID. */
export function getGroupForCategory(id: string): TaxonomyGroup | undefined {
  return TAXONOMY.find(g => g.categories.some(c => c.id === id));
}
