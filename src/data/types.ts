export type Role = "staff" | "admin";

/** Yöneticinin değiştirebildiği tek ayarlar. Diğer kurallar engine.ts içinde sabittir. */
export interface ProgramRules {
  stampsRequired: number;
  rewardName: string;
}

export interface Staff {
  id: string;
  name: string;
  role: Role;
  /** Demo: PIN tarayıcıda düz metin tutulur. Gerçek sürümde sunucuda özetlenmiş (hash) saklanmalı. */
  pin: string;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string; // E.164, örnek veri
  joinedAt: string;
  kvkkAt: string;
}

/**
 * Damga defteri: kayıtlar silinmez, düzeltme yeni kayıtla yapılır.
 * earn: kasada +1 · convert: kart doldu, damgalar ödüle dönüştü · undo: kasada geri alma · adjust: yönetici düzeltmesi
 */
export type LedgerType = "earn" | "convert" | "undo" | "adjust";

export interface LedgerEntry {
  id: string;
  customerId: string;
  type: LedgerType;
  amount: number;
  staffId: string;
  grantId?: string;
  reversalOf?: string;
  createdAt: string;
}

/** void: kartı dolduran damga geri alındığı için iptal edilen ödül */
export type GrantStatus = "available" | "redeemed" | "expired" | "void";

export interface RewardGrant {
  id: string;
  customerId: string;
  rewardName: string;
  status: GrantStatus;
  createdAt: string;
  expiresAt: string;
  redeemedAt?: string;
  redeemedBy?: string;
}

/** Personel ve yönetici işlem kaydı (kim, ne zaman, hangi müşteri, ne yaptı). */
export type AuditKind = "stamp" | "stamp_undo" | "reward" | "reward_undo" | "adjust" | "rules" | "staff";

export interface AuditEntry {
  id: string;
  at: string;
  staffId: string;
  kind: AuditKind;
  customerId?: string;
  delta?: number;
  note?: string;
}

export interface AppState {
  version: number;
  rules: ProgramRules;
  staff: Staff[];
  customers: Customer[];
  ledger: LedgerEntry[];
  grants: RewardGrant[];
  audit: AuditEntry[];
  /** Müşteri uygulamasında oturum açmış üye ve kutlaması gösterilmiş ödüller */
  session: { customerId: string | null; seenGrantIds: string[] };
  /** Kasa / yönetim ekranında PIN ile giriş yapmış personel */
  desk: { staffId: string | null };
  demo: { skipCooldown: boolean };
}
