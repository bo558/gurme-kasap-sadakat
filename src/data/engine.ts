import { COOLDOWN_MINUTES, DEMO_STAFF_ID, REWARD_VALID_DAYS, UNDO_WINDOW_MS } from "./defaults";
import type { AppState, AuditEntry, Customer, LedgerEntry, ProgramRules, RewardGrant, Staff } from "./types";

/**
 * Sadakat iş kuralları. Prototipte saf fonksiyonlardır ve tarayıcıda çalışır.
 * Gerçek sistemde aynı kontroller sunucuda, tek bir veritabanı işlemi (transaction) içinde yapılmalıdır;
 * tarayıcıdaki kontrol tek başına güvenlik sağlamaz.
 */

let counter = 0;
export const uid = (p: string) => `${p}-${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const DAY = 86_400_000;
/** Geri alma süresi ekranda 10 sn; ağ/dokunma gecikmesi için küçük bir pay bırakılır. */
const UNDO_GRACE_MS = 3_000;

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type Out<T = object> = { state: AppState; result: Result<T> };
const fail = <T,>(state: AppState, error: string): Out<T> => ({ state, result: { ok: false, error } });

/* ---------------- Okuma ---------------- */

export function balanceOf(state: AppState, customerId: string): number {
  return state.ledger.reduce((s, e) => (e.customerId === customerId ? s + e.amount : s), 0);
}

/** Süresi geçmiş ödüller okuma anında "expired" sayılır. */
export function grantsOf(state: AppState, customerId: string, now = Date.now()): RewardGrant[] {
  return state.grants
    .filter((g) => g.customerId === customerId && g.status !== "void")
    .map((g) => (g.status === "available" && Date.parse(g.expiresAt) < now ? { ...g, status: "expired" as const } : g))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function availableGrants(state: AppState, customerId: string, now = Date.now()) {
  return grantsOf(state, customerId, now).filter((g) => g.status === "available");
}

export function isReversed(state: AppState, entryId: string) {
  return state.ledger.some((e) => e.reversalOf === entryId);
}

/** Geri alınmamış son kasa damgası. */
export function lastEarn(state: AppState, customerId: string): LedgerEntry | undefined {
  let last: LedgerEntry | undefined;
  for (const e of state.ledger)
    if (e.customerId === customerId && e.type === "earn" && (!last || e.createdAt > last.createdAt) && !isReversed(state, e.id)) last = e;
  return last;
}

/** Bekleme süresinden kalan milisaniye (0 = damga verilebilir). */
export function cooldownLeft(state: AppState, customerId: string, now = Date.now()): number {
  if (state.demo.skipCooldown) return 0;
  const last = lastEarn(state, customerId);
  if (!last) return 0;
  return Math.max(0, COOLDOWN_MINUTES * 60_000 - (now - Date.parse(last.createdAt)));
}

export const staffName = (state: AppState, id: string) =>
  id === DEMO_STAFF_ID ? "Demo kısayolu" : (state.staff.find((s) => s.id === id)?.name ?? "—");

/* ---------------- Ortak yardımcılar ---------------- */

function audit(state: AppState, e: Omit<AuditEntry, "id">): AppState {
  return { ...state, audit: [...state.audit, { id: uid("au"), ...e }] };
}

function checkStaff(state: AppState, staffId: string, role?: Staff["role"]): string | null {
  if (staffId === DEMO_STAFF_ID) return null;
  const st = state.staff.find((s) => s.id === staffId);
  if (!st || !st.active) return "Personel oturumu geçersiz. Yeniden PIN ile giriş yapın.";
  if (role === "admin" && st.role !== "admin") return "Bu işlem için yönetici yetkisi gerekir.";
  return null;
}

/**
 * Damga ekler; kart dolarsa aynı adımda damgaları ödüle çevirir.
 * İlk eklenen kaydın kimliği ve (varsa) açılan ödül döner.
 */
function addStamps(state: AppState, customerId: string, amount: number, type: "earn" | "adjust", staffId: string, at: string) {
  const r = state.rules;
  const first: LedgerEntry = { id: uid("lx"), customerId, type, amount, staffId, createdAt: at };
  const ledger: LedgerEntry[] = [first];
  const grants: RewardGrant[] = [];
  let balance = balanceOf(state, customerId) + amount;
  while (balance >= r.stampsRequired) {
    const g: RewardGrant = {
      id: uid("gr"),
      customerId,
      rewardName: r.rewardName,
      status: "available",
      createdAt: at,
      expiresAt: new Date(Date.parse(at) + REWARD_VALID_DAYS * DAY).toISOString(),
    };
    grants.push(g);
    ledger.push({ id: uid("lx"), customerId, type: "convert", amount: -r.stampsRequired, staffId, grantId: g.id, createdAt: at });
    balance -= r.stampsRequired;
  }
  // Kartı dolduran kayıt, açtığı ödülü bilir: geri alınırsa ödül de iptal edilir.
  if (grants.length) first.grantId = grants[0]!.id;
  return {
    state: { ...state, ledger: [...state.ledger, ...ledger], grants: [...state.grants, ...grants] },
    entryId: first.id,
    grantId: grants[0]?.id,
    balance,
  };
}

/* ---------------- Kasa işlemleri ---------------- */

export interface EarnOk {
  entryId: string;
  grantId?: string;
  balance: number;
}

/** Kasada +1 damga (sipariş başına bir). */
export function earnStamp(state: AppState, input: { customerId: string; staffId: string; ignoreCooldown?: boolean; at?: number }): Out<EarnOk> {
  const now = input.at ?? Date.now();
  const customer = state.customers.find((c) => c.id === input.customerId);
  if (!customer) return fail(state, "Müşteri bulunamadı.");
  const staffErr = checkStaff(state, input.staffId);
  if (staffErr) return fail(state, staffErr);
  const wait = input.ignoreCooldown ? 0 : cooldownLeft(state, customer.id, now);
  if (wait > 0) {
    const last = lastEarn(state, customer.id)!;
    return fail(state, `Bu müşteriye ${fmtAgo(now - Date.parse(last.createdAt))} önce damga verildi. Aynı siparişe ikinci damga verilmez; yeni damga ${fmtMinutes(wait)} sonra.`);
  }
  const at = new Date(now).toISOString();
  const out = addStamps(state, customer.id, 1, "earn", input.staffId, at);
  const s = audit(out.state, { at, staffId: input.staffId, kind: "stamp", customerId: customer.id, delta: 1, note: out.grantId ? "Kart doldu, ödül açıldı" : undefined });
  return { state: s, result: { ok: true, entryId: out.entryId, grantId: out.grantId, balance: out.balance } };
}

/** Kasada yanlışlıkla verilen damgayı kısa süre içinde geri alır (kayıt silinmez, ters kayıt eklenir). */
export function undoStamp(state: AppState, entryId: string, staffId: string, now = Date.now()): Out {
  const e = state.ledger.find((x) => x.id === entryId);
  if (!e || e.type !== "earn") return fail(state, "Geri alınacak damga bulunamadı.");
  if (isReversed(state, e.id)) return fail(state, "Bu damga zaten geri alındı.");
  if (now - Date.parse(e.createdAt) > UNDO_WINDOW_MS + UNDO_GRACE_MS) return fail(state, "Geri alma süresi doldu. Düzeltme için yöneticiye başvurun.");
  const at = new Date(now).toISOString();
  const ledger: LedgerEntry[] = [{ id: uid("lx"), customerId: e.customerId, type: "undo", amount: -1, staffId, reversalOf: e.id, createdAt: at }];
  let grants = state.grants;
  if (e.grantId) {
    const g = state.grants.find((x) => x.id === e.grantId);
    if (g && g.status !== "available") return fail(state, "Bu damgayla açılan ödül kullanıldığı için damga geri alınamaz.");
    const conv = state.ledger.find((x) => x.type === "convert" && x.grantId === e.grantId);
    if (conv) ledger.push({ id: uid("lx"), customerId: e.customerId, type: "undo", amount: -conv.amount, staffId, reversalOf: conv.id, createdAt: at });
    grants = grants.map((x) => (x.id === e.grantId ? { ...x, status: "void" as const } : x));
  }
  const s = audit({ ...state, ledger: [...state.ledger, ...ledger], grants }, { at, staffId, kind: "stamp_undo", customerId: e.customerId, delta: -1 });
  return { state: s, result: { ok: true } };
}

/** Ödül kullanımı: yalnızca "kullanılabilir" durumdaki ödül, bir kez "kullanıldı" olur. */
export function redeemGrant(state: AppState, grantId: string, staffId: string, now = Date.now()): Out {
  const raw = state.grants.find((x) => x.id === grantId);
  const g = raw && grantsOf(state, raw.customerId, now).find((x) => x.id === grantId);
  if (!g) return fail(state, "Ödül bulunamadı.");
  if (g.status === "redeemed") return fail(state, `Bu ödül ${fmtDateTime(g.redeemedAt!)} tarihinde zaten kullanıldı.`);
  if (g.status === "expired") return fail(state, "Bu ödülün süresi dolmuş.");
  const staffErr = checkStaff(state, staffId);
  if (staffErr) return fail(state, staffErr);
  const at = new Date(now).toISOString();
  const s = audit(
    { ...state, grants: state.grants.map((x) => (x.id === grantId ? { ...x, status: "redeemed" as const, redeemedAt: at, redeemedBy: staffId } : x)) },
    { at, staffId, kind: "reward", customerId: g.customerId, note: g.rewardName },
  );
  return { state: s, result: { ok: true } };
}

/** Yanlışlıkla kullandırılan ödülü kısa süre içinde geri açar. */
export function undoRedeem(state: AppState, grantId: string, staffId: string, now = Date.now()): Out {
  const g = state.grants.find((x) => x.id === grantId);
  if (!g || g.status !== "redeemed" || !g.redeemedAt) return fail(state, "Geri alınacak ödül kullanımı bulunamadı.");
  if (now - Date.parse(g.redeemedAt) > UNDO_WINDOW_MS + UNDO_GRACE_MS) return fail(state, "Geri alma süresi doldu. Düzeltme için yöneticiye başvurun.");
  const at = new Date(now).toISOString();
  const s = audit(
    { ...state, grants: state.grants.map((x) => (x.id === grantId ? { ...x, status: "available" as const, redeemedAt: undefined, redeemedBy: undefined } : x)) },
    { at, staffId, kind: "reward_undo", customerId: g.customerId, note: g.rewardName },
  );
  return { state: s, result: { ok: true } };
}

/* ---------------- Yönetici işlemleri ---------------- */

export const ADJUST_REASONS = ["Unutulan damga", "Yanlış müşteriye verilmiş", "Müşteri şikâyeti / telafi", "Diğer"] as const;

export function adjustStamps(state: AppState, customerId: string, delta: 1 | -1, reason: string, staffId: string, now = Date.now()): Out<{ grantId?: string }> {
  const staffErr = checkStaff(state, staffId, "admin");
  if (staffErr) return fail(state, staffErr);
  if (!state.customers.some((c) => c.id === customerId)) return fail(state, "Müşteri bulunamadı.");
  if (!reason.trim()) return fail(state, "Düzeltme için bir gerekçe seçin.");
  if (delta < 0 && balanceOf(state, customerId) < 1) return fail(state, "Kartta çıkarılacak damga yok.");
  const at = new Date(now).toISOString();
  const out = addStamps(state, customerId, delta, "adjust", staffId, at);
  const s = audit(out.state, { at, staffId, kind: "adjust", customerId, delta, note: reason });
  return { state: s, result: { ok: true, grantId: out.grantId } };
}

/** Program ayarları. Damga sayısı düşürülürse kartı dolan müşterilerin ödülleri hemen açılır. */
export function updateRules(state: AppState, rules: ProgramRules, staffId: string, now = Date.now()): Out {
  const staffErr = checkStaff(state, staffId, "admin");
  if (staffErr) return fail(state, staffErr);
  const name = rules.rewardName.trim();
  if (name.length < 2) return fail(state, "Ödül adını yazın.");
  if (!Number.isInteger(rules.stampsRequired) || rules.stampsRequired < 3 || rules.stampsRequired > 20) return fail(state, "Damga sayısı 3 ile 20 arasında olmalı.");
  const at = new Date(now).toISOString();
  let s: AppState = { ...state, rules: { stampsRequired: rules.stampsRequired, rewardName: name } };
  for (const c of s.customers) if (balanceOf(s, c.id) >= rules.stampsRequired) s = addStamps(s, c.id, 0, "adjust", staffId, at).state;
  s = { ...s, ledger: s.ledger.filter((e) => !(e.type === "adjust" && e.amount === 0)) };
  s = audit(s, { at, staffId, kind: "rules", note: `${rules.stampsRequired} damga = 1 ${name}` });
  return { state: s, result: { ok: true } };
}

export function addStaff(state: AppState, input: { name: string; pin: string; role: Staff["role"] }, staffId: string): Out {
  const staffErr = checkStaff(state, staffId, "admin");
  if (staffErr) return fail(state, staffErr);
  if (input.name.trim().length < 2) return fail(state, "Personelin adını yazın.");
  if (!/^\d{4}$/.test(input.pin)) return fail(state, "PIN 4 haneli olmalı.");
  if (state.staff.some((s) => s.pin === input.pin)) return fail(state, "Bu PIN başka bir personelde kullanılıyor.");
  const st: Staff = { id: uid("st"), name: input.name.trim(), pin: input.pin, role: input.role, active: true };
  const s = audit({ ...state, staff: [...state.staff, st] }, { at: new Date().toISOString(), staffId, kind: "staff", note: `${st.name} eklendi` });
  return { state: s, result: { ok: true } };
}

export function setStaffActive(state: AppState, targetId: string, active: boolean, staffId: string): Out {
  const staffErr = checkStaff(state, staffId, "admin");
  if (staffErr) return fail(state, staffErr);
  if (targetId === staffId) return fail(state, "Kendi erişiminizi kapatamazsınız.");
  const t = state.staff.find((s) => s.id === targetId);
  if (!t) return fail(state, "Personel bulunamadı.");
  if (!active && t.role === "admin" && state.staff.filter((s) => s.role === "admin" && s.active).length <= 1) return fail(state, "En az bir yönetici açık kalmalı.");
  const s = audit(
    { ...state, staff: state.staff.map((x) => (x.id === targetId ? { ...x, active } : x)) },
    { at: new Date().toISOString(), staffId, kind: "staff", note: `${t.name} erişimi ${active ? "açıldı" : "kapatıldı"}` },
  );
  return { state: s, result: { ok: true } };
}

export function verifyPin(state: AppState, pin: string): Staff | undefined {
  return state.staff.find((s) => s.active && s.pin === pin);
}

/* ---------------- Müşteri hesabı ---------------- */

export function findByPhone(state: AppState, phone: string) {
  return state.customers.find((c) => c.phone === phone);
}

export function registerCustomer(state: AppState, input: { name: string; phone: string }): { state: AppState; customer: Customer } {
  const at = new Date().toISOString();
  const customer: Customer = { id: uid("cu"), name: input.name.trim(), phone: input.phone, joinedAt: at, kvkkAt: at };
  return { state: { ...state, customers: [...state.customers, customer] }, customer };
}

/** Demo: kişisel veriler yalnızca bu tarayıcıdaki örnek veriden silinir. İşlem kaydında üye "silinmiş" görünür. */
export function deleteCustomer(state: AppState, id: string): AppState {
  return {
    ...state,
    customers: state.customers.filter((c) => c.id !== id),
    ledger: state.ledger.filter((e) => e.customerId !== id),
    grants: state.grants.filter((g) => g.customerId !== id),
    session: { ...state.session, customerId: state.session.customerId === id ? null : state.session.customerId },
  };
}

/* ---------------- QR ----------------
   Tek QR: hem damga hem ödül için aynı kod. 60 sn'lik zaman penceresine bağlıdır ve müşteri kimliğini açıkça taşımaz.
   DEMO: kod tarayıcıda, herkesin görebileceği basit bir özetle üretilir; kriptografik olarak güvenli değildir.
   Gerçek sürümde kod sunucunun gizli anahtarıyla imzalanmalı ve sunucuda doğrulanmalıdır. */
export const QR_WINDOW_MS = 60_000;
export const qrWindow = (now = Date.now()) => Math.floor(now / QR_WINDOW_MS);
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function backupCode(customerId: string, win = qrWindow()) {
  return String(hash(`${customerId}:${win}:gkb-demo`) % 1_000_000).padStart(6, "0");
}
export function qrPayload(customerId: string, win = qrWindow()) {
  return `GKB1.${win.toString(36)}.${hash(`${customerId}:${win}`).toString(36)}.${backupCode(customerId, win)}`;
}
/** Güncel ya da bir önceki dakikanın kodunu kabul eder (ekran yenilenirken okutma için pay). */
export function resolveCode(state: AppState, code: string, now = Date.now()): Customer | undefined {
  const c = code.trim().replace(/\s/g, "");
  const win = qrWindow(now);
  return state.customers.find((cu) => [win, win - 1].some((w) => backupCode(cu.id, w) === c || qrPayload(cu.id, w) === c));
}

/* ---------------- Biçimlendirme ---------------- */
export const fmtDate = (iso: string) => new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
export const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const fmtMinutes = (ms: number) => {
  const m = Math.ceil(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)} sa ${m % 60 ? `${m % 60} dk` : ""}`.trim() : `${m} dk`;
};
export const fmtAgo = (ms: number) => (ms < 60_000 ? "az" : fmtMinutes(ms));
export const maskPhone = (p: string) => {
  const d = p.replace(/\D/g, "").slice(-10);
  return `0${d.slice(0, 3)} ••• •• ${d.slice(8, 10)}`;
};
export const daysLeft = (iso: string) => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / DAY));
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase("tr-TR"))
    .join("");
