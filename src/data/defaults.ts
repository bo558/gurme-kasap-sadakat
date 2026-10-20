import type { ProgramRules, Staff } from "./types";

/**
 * DEMO VARSAYIMI — Gurme Kasap Burger tarafından henüz onaylanmış kampanya koşulları değildir.
 * Sipariş başına 1 damga, 10 damga = 1 Burger Menü. Yönetim panelinden değiştirilebilir.
 */
export const DEFAULT_RULES: ProgramRules = {
  stampsRequired: 10,
  rewardName: "Burger Menü",
};

/** Sabit demo kuralları (ekranda bilgi olarak gösterilir, ayar olarak değiştirilmez). */
export const REWARD_VALID_DAYS = 90;
/** Aynı müşteriye arka arkaya damga verilmesini engelleyen bekleme süresi. */
export const COOLDOWN_MINUTES = 120;
/** Kasada "Geri al" süresi. */
export const UNDO_WINDOW_MS = 10_000;

/** ÖRNEK PERSONEL — uydurma isimler; demo PIN'leri giriş ekranında açıkça gösterilir. */
export const DEFAULT_STAFF: Staff[] = [
  { id: "st-murat", name: "Murat A.", role: "staff", pin: "1111", active: true },
  { id: "st-elif", name: "Elif S.", role: "staff", pin: "2222", active: true },
  { id: "st-deniz", name: "Deniz Y.", role: "admin", pin: "9999", active: true },
  { id: "st-okan", name: "Okan B.", role: "staff", pin: "3333", active: false },
];

export const ROLE_LABEL: Record<Staff["role"], string> = {
  staff: "Kasa personeli",
  admin: "Yönetici",
};

/** Demo kısayollarıyla yapılan işlemler bu kimlikle kaydedilir (gerçek personel değildir). */
export const DEMO_STAFF_ID = "demo";
