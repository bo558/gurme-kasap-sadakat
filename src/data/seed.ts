import { DEFAULT_RULES, DEFAULT_STAFF } from "./defaults";
import { earnStamp, redeemGrant } from "./engine";
import type { AppState, Customer } from "./types";

/** ÖRNEK VERİ — gerçek müşteri bilgisi değildir. İsimler ve numaralar uydurmadır. */
const PEOPLE: { name: string; visits: number; redeemAll?: boolean; joinedDaysAgo: number }[] = [
  { name: "Nazlı Erdem", visits: 17, joinedDaysAgo: 120 }, // demo üyesi: 7 damga + 1 hazır ödül
  { name: "Cem Uysal", visits: 9, joinedDaysAgo: 75 },
  { name: "Gizem Tunç", visits: 28, joinedDaysAgo: 210, redeemAll: true },
  { name: "Barış Kılıç", visits: 4, joinedDaysAgo: 30 },
  { name: "İpek Duman", visits: 19, joinedDaysAgo: 64 },
  { name: "Serkan Aksoy", visits: 1, joinedDaysAgo: 6 },
  { name: "Melis Karaca", visits: 21, joinedDaysAgo: 160, redeemAll: true },
  { name: "Emir Polat", visits: 12, joinedDaysAgo: 140, redeemAll: true },
  { name: "Pınar Ateş", visits: 0, joinedDaysAgo: 2 },
  { name: "Alper Yazıcı", visits: 6, joinedDaysAgo: 48 },
];

export const DEMO_CUSTOMER_INDEX = 0;
export const SEED_VERSION = 1;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function buildSeed(): AppState {
  const rand = rng(42);
  const now = Date.now();
  const DAY = 86_400_000;
  let state: AppState = {
    version: SEED_VERSION,
    rules: { ...DEFAULT_RULES },
    staff: DEFAULT_STAFF.map((s) => ({ ...s })),
    customers: [],
    ledger: [],
    grants: [],
    audit: [],
    session: { customerId: null, seenGrantIds: [] },
    desk: { staffId: null },
    demo: { skipCooldown: false },
  };

  PEOPLE.forEach((p, i) => {
    const joined = now - p.joinedDaysAgo * DAY - Math.floor(rand() * 5) * 3_600_000;
    // Açıkça kurgusal numara: 0500 000 00 01, 02, … (gerçek kişilere ait olmaması için)
    const c: Customer = {
      id: `cu-demo-${i + 1}`,
      name: p.name,
      phone: `+905000000${String(i + 1).padStart(3, "0")}`,
      joinedAt: new Date(joined).toISOString(),
      kvkkAt: new Date(joined).toISOString(),
    };
    state.customers.push(c);
    const span = (now - joined) / DAY;
    const times = Array.from({ length: p.visits }, (_, k) => joined + ((k + 0.5 + rand() * 0.4) / (p.visits + 0.3)) * span * DAY)
      .map((t) => {
        const d = new Date(t);
        d.setHours(12 + Math.floor(rand() * 10), Math.floor(rand() * 60));
        return Math.min(d.getTime(), now - 3 * 3_600_000);
      })
      .sort((a, b) => a - b);
    times.forEach((at) => {
      const staffId = rand() > 0.5 ? "st-murat" : "st-elif";
      state = earnStamp(state, { customerId: c.id, staffId, ignoreCooldown: true, at }).state;
    });
    // Geçmiş ödüllerin bir kısmı kullanılmış
    const mine = state.grants.filter((g) => g.customerId === c.id);
    mine.forEach((g, gi) => {
      if (p.redeemAll || gi < mine.length - 1) {
        const at = Math.min(Date.parse(g.createdAt) + (2 + Math.floor(rand() * 8)) * DAY, now - DAY);
        state = redeemGrant(state, g.id, "st-murat", at).state;
      }
    });
  });
  state.audit.sort((a, b) => a.at.localeCompare(b.at));
  // Geçmiş ödüller "görüldü" sayılır, yalnızca demoda kazanılanlar kutlanır
  state.session.seenGrantIds = state.grants.map((g) => g.id);
  return state;
}
