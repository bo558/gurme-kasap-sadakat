import { Eye, EyeOff, LogOut, Minus, Plus, ScanLine, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { BrandLogo, Sheet, StampCard, Toasts } from "../components/brand";
import { COOLDOWN_MINUTES, REWARD_VALID_DAYS, ROLE_LABEL } from "../data/defaults";
import {
  addStaff,
  ADJUST_REASONS,
  adjustStamps,
  availableGrants,
  balanceOf,
  daysLeft,
  fmtDate,
  fmtDateTime,
  grantsOf,
  initials,
  maskPhone,
  setStaffActive,
  staffName,
  updateRules,
} from "../data/engine";
import type { AppState, AuditEntry, Customer, Role } from "../data/types";
import { useStore } from "../store/store";
import { Btn, HeaderBtn, inputCls, Panel, PinGate, useDeskStaff, useLogout } from "./ui";

export function YonetimApp({ go }: { go: (p: string) => void }) {
  return (
    <PinGate title="Yönetim" needAdmin>
      <Yonetim go={go} />
    </PinGate>
  );
}

function Yonetim({ go }: { go: (p: string) => void }) {
  const me = useDeskStaff()!;
  const logout = useLogout();
  return (
    <div className="paper-grain min-h-[calc(100dvh-var(--demo-bar))]">
      <header className="sticky top-[var(--demo-bar)] z-30 flex items-center gap-3 border-b border-line bg-card px-4 py-2.5 sm:px-6">
        <BrandLogo height={36} />
        <div className="min-w-0 flex-1 border-l border-line pl-3">
          <div className="t-h1 leading-none">Yönetim</div>
          <div className="mt-0.5 truncate text-[13px] text-muted">{me.name}</div>
        </div>
        <button onClick={() => go("kasa")} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-kasap px-3.5 text-[13px] font-bold text-white hover:bg-kasap-deep">
          <ScanLine className="h-4 w-4" /> Kasa
        </button>
        <HeaderBtn onClick={logout} label="Çıkış" ariaLabel="Çıkış yap" icon={<LogOut className="h-4 w-4" />} />
      </header>
      <main className="mx-auto grid max-w-[1100px] gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-4">
          <Customers />
          <ActivityLog />
        </div>
        <div className="grid gap-4">
          <Program />
          <StaffPanel />
        </div>
      </main>
      <Toasts />
    </div>
  );
}

/* ---------------- Müşteri bul ve düzelt ---------------- */
function Customers() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const s = q.trim().toLocaleLowerCase("tr-TR");
  const digits = q.replace(/\D/g, "");
  const list = useMemo(() => {
    const lastSeen = (id: string) => state.audit.reduce((m, a) => (a.customerId === id && a.at > m ? a.at : m), "");
    const all = state.customers.map((c) => ({ c, seen: lastSeen(c.id) || c.joinedAt }));
    const hit = s
      ? all.filter(({ c }) => c.name.toLocaleLowerCase("tr-TR").includes(s) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)))
      : all;
    return hit.sort((a, b) => b.seen.localeCompare(a.seen)).slice(0, s ? 10 : 5);
  }, [state.customers, state.audit, s, digits]);
  const sel = state.customers.find((c) => c.id === open);

  return (
    <Panel title="Müşteriler" action={<span className="text-[13px] text-muted">{state.customers.length} üye</span>}>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <label htmlFor="yn-q" className="sr-only">
          Müşteri ara
        </label>
        <input id="yn-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad ya da telefon numarası" className={`${inputCls} pl-10`} autoComplete="off" />
      </div>
      <div className="mt-3 t-label text-muted">{s ? "Sonuçlar" : "Son gelenler"}</div>
      <ul className="mt-1.5 divide-y divide-line">
        {list.map(({ c }) => {
          const avail = availableGrants(state, c.id).length;
          return (
            <li key={c.id}>
              <button onClick={() => setOpen(c.id)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-paper/60">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-char font-display text-[15px] font-semibold text-paper">{initials(c.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{c.name}</span>
                  <span className="block text-[13px] text-muted tabular">{maskPhone(c.phone)}</span>
                </span>
                <span className="shrink-0 text-right text-[14px] font-semibold tabular">
                  {balanceOf(state, c.id)}/{state.rules.stampsRequired}
                  {avail > 0 && <span className="block text-[12px] font-semibold text-kasap-deep">ödül hazır</span>}
                </span>
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="py-4 text-[14px] text-muted">Eşleşen üye yok.</li>}
      </ul>
      {sel && <CustomerSheet c={sel} onClose={() => setOpen(null)} />}
    </Panel>
  );
}

function CustomerSheet({ c, onClose }: { c: Customer; onClose: () => void }) {
  const { state, update, toast } = useStore();
  const me = useDeskStaff()!;
  const [delta, setDelta] = useState<1 | -1 | null>(null);
  const [reason, setReason] = useState("");
  const r = state.rules;
  const bal = balanceOf(state, c.id);
  const grants = grantsOf(state, c.id).reverse();
  const history = state.audit.filter((a) => a.customerId === c.id).slice(-25).reverse();

  const apply = () => {
    if (!delta) return;
    update((s) => {
      const out = adjustStamps(s, c.id, delta, reason, me.id);
      if (!out.result.ok) toast(out.result.error, "bad");
      else toast(out.result.grantId ? "Damga eklendi; kart doldu ve ödül açıldı." : delta > 0 ? "1 damga eklendi." : "1 damga çıkarıldı.");
      return out.state;
    });
    setDelta(null);
    setReason("");
  };

  return (
    <Sheet label={c.name} onClose={onClose} fixedTo="page">
      <div className="flex items-center gap-3 pr-10">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-char font-display text-[17px] font-semibold text-paper">{initials(c.name)}</span>
        <div className="min-w-0">
          <div className="t-h1 truncate">{c.name}</div>
          <div className="text-[13px] text-muted tabular">
            {maskPhone(c.phone)} · {fmtDate(c.joinedAt)}'den beri üye
          </div>
        </div>
      </div>
      <div className="mt-4">
        <StampCard stamps={bal} required={r.stampsRequired} rewardName={r.rewardName} compact />
      </div>

      {grants.some((g) => g.status === "available") && (
        <div className="mt-3 grid gap-1.5">
          {grants
            .filter((g) => g.status === "available")
            .map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-xl bg-kasap-soft px-3.5 py-2.5 text-[14px] ring-1 ring-kasap/30">
                <b className="font-semibold">{g.rewardName} hazır</b>
                <span className="text-muted">son {daysLeft(g.expiresAt)} gün</span>
              </div>
            ))}
        </div>
      )}

      <section className="mt-5">
        <div className="t-label text-muted">Damga düzelt</div>
        {delta === null ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Btn tone="ghost" onClick={() => setDelta(-1)} disabled={bal < 1}>
              <Minus className="h-4 w-4" /> 1 damga çıkar
            </Btn>
            <Btn tone="ghost" onClick={() => setDelta(1)}>
              <Plus className="h-4 w-4" /> 1 damga ekle
            </Btn>
          </div>
        ) : (
          <div className="mt-2 rounded-xl bg-paper p-3 ring-1 ring-line">
            <div className="text-[15px] font-semibold">{delta > 0 ? "1 damga eklenecek" : "1 damga çıkarılacak"} · gerekçe seçin</div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {ADJUST_REASONS.map((x) => (
                <button key={x} onClick={() => setReason(x)} className={`h-10 rounded-full px-3.5 text-[14px] font-medium ${reason === x ? "bg-char text-paper" : "bg-white ring-1 ring-line"}`}>
                  {x}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Btn tone="ghost" onClick={() => (setDelta(null), setReason(""))}>
                Vazgeç
              </Btn>
              <Btn tone="dark" onClick={apply} disabled={!reason}>
                Onayla
              </Btn>
            </div>
            <p className="mt-2 text-[13px] text-muted">Kayıt silinmez; düzeltme, gerekçesi ve sizin adınızla işlem kaydına eklenir.</p>
          </div>
        )}
      </section>

      <section className="mt-5">
        <div className="t-label text-muted">Geçmiş</div>
        <ul className="mt-1.5 divide-y divide-line">
          {history.map((a) => (
            <AuditRow key={a.id} a={a} state={state} />
          ))}
          {history.length === 0 && <li className="py-3 text-[14px] text-muted">Henüz işlem yok.</li>}
        </ul>
      </section>
    </Sheet>
  );
}

/* ---------------- İşlem kaydı ---------------- */
const KIND: Record<AuditEntry["kind"], string> = {
  stamp: "+1 damga",
  stamp_undo: "Damga geri alındı",
  reward: "Ödül kullanıldı",
  reward_undo: "Ödül kullanımı geri alındı",
  adjust: "Düzeltme",
  rules: "Program ayarı değişti",
  staff: "Personel",
};

function AuditRow({ a, state, showCustomer }: { a: AuditEntry; state: AppState; showCustomer?: boolean }) {
  const cust = a.customerId ? (state.customers.find((c) => c.id === a.customerId)?.name ?? "Silinmiş üye") : null;
  const warn = a.kind === "stamp_undo" || a.kind === "reward_undo" || a.kind === "adjust";
  const title = a.kind === "adjust" ? `${KIND.adjust} ${a.delta && a.delta > 0 ? "+1" : "−1"}` : KIND[a.kind];
  return (
    <li className="flex items-start gap-3 py-2.5 text-[14px]">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${warn ? "bg-bad" : a.kind === "reward" ? "bg-kasap" : "bg-char/30"}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">
          {title}
          {showCustomer && cust && <span className="font-normal text-muted"> · {cust}</span>}
        </div>
        <div className="text-[13px] text-muted">
          {staffName(state, a.staffId)}
          {a.note && a.kind !== "reward" && a.kind !== "reward_undo" ? ` · ${a.note}` : ""}
        </div>
      </div>
      <span className="shrink-0 text-[13px] text-muted tabular">{fmtDateTime(a.at)}</span>
    </li>
  );
}

function ActivityLog() {
  const { state } = useStore();
  const [n, setN] = useState(8);
  const rows = state.audit.slice(-n).reverse();
  return (
    <Panel title="İşlem kaydı" action={<span className="text-[13px] text-muted">Kim, ne zaman, ne yaptı</span>}>
      <ul className="divide-y divide-line">
        {rows.map((a) => (
          <AuditRow key={a.id} a={a} state={state} showCustomer />
        ))}
      </ul>
      {state.audit.length > n && (
        <button onClick={() => setN(n + 15)} className="mt-2 h-11 w-full rounded-xl text-[14px] font-semibold text-muted hover:bg-paper">
          Daha fazla göster
        </button>
      )}
    </Panel>
  );
}

/* ---------------- Program ayarları ---------------- */
function Program() {
  const { state, update, toast } = useStore();
  const me = useDeskStaff()!;
  const [count, setCount] = useState(state.rules.stampsRequired);
  const [name, setName] = useState(state.rules.rewardName);
  const dirty = count !== state.rules.stampsRequired || name.trim() !== state.rules.rewardName;
  return (
    <Panel title="Program" action={<span className="rounded-full bg-gold-soft px-2.5 py-1 text-[12px] font-bold text-gold-ink ring-1 ring-gold/40">Demo varsayımı</span>}>
      <p className="mb-4 rounded-xl bg-paper px-3.5 py-3 text-[13px] leading-relaxed text-muted ring-1 ring-line">
        Bu koşullar henüz Gurme Kasap Burger tarafından onaylanmış kampanya koşulları değildir; sunum için örnek olarak girilmiştir.
      </p>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          update((s) => {
            const out = updateRules(s, { stampsRequired: count, rewardName: name }, me.id);
            if (!out.result.ok) toast(out.result.error, "bad");
            else toast("Program güncellendi. Müşteri kartları da güncellendi.");
            return out.state;
          });
        }}
      >
        <div>
          <div className="t-label text-muted">Ödül için gereken damga</div>
          <div className="mt-2 flex items-center gap-2">
            <Btn tone="ghost" onClick={() => setCount(Math.max(3, count - 1))} className="w-12 px-0" disabled={count <= 3}>
              <Minus className="h-4 w-4" />
              <span className="sr-only">Azalt</span>
            </Btn>
            <output className="t-num w-16 text-center text-[32px]" aria-live="polite">
              {count}
            </output>
            <Btn tone="ghost" onClick={() => setCount(Math.min(20, count + 1))} className="w-12 px-0" disabled={count >= 20}>
              <Plus className="h-4 w-4" />
              <span className="sr-only">Artır</span>
            </Btn>
          </div>
        </div>
        <div>
          <label htmlFor="yn-reward" className="t-label text-muted">
            Ödül
          </label>
          <input id="yn-reward" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={`${inputCls} mt-2`} />
        </div>
        <div>
          <div className="t-label text-muted">Sabit kurallar (demo)</div>
          <ul className="mt-2 grid gap-1 text-[14px]">
            <li>• Her siparişte 1 damga · hoş geldin damgası yok</li>
            <li>• Damgalar süresiz · ödül {REWARD_VALID_DAYS} gün geçerli</li>
            <li>• Aynı müşteriye {COOLDOWN_MINUTES} dk içinde ikinci damga verilmez</li>
            <li>• Ödül yalnızca bir kez kullanılır</li>
          </ul>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">Damga sayısı ve ödül değişikliği tüm kartlara hemen yansır.</p>
        </div>
        <div className="flex gap-2">
          <Btn type="submit" disabled={!dirty || name.trim().length < 2}>
            Kaydet
          </Btn>
          {dirty && (
            <Btn tone="ghost" onClick={() => (setCount(state.rules.stampsRequired), setName(state.rules.rewardName))}>
              Vazgeç
            </Btn>
          )}
        </div>
      </form>
    </Panel>
  );
}

/* ---------------- Personel ---------------- */
function StaffPanel() {
  const { state, update, toast } = useStore();
  const me = useDeskStaff()!;
  const [show, setShow] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<Role>("staff");

  const run = (fn: (s: AppState) => { state: AppState; result: { ok: true } | { ok: false; error: string } }, okText: string) =>
    update((s) => {
      const out = fn(s);
      if (!out.result.ok) toast(out.result.error, "bad");
      else toast(okText);
      return out.state;
    });

  return (
    <Panel
      title="Personel"
      action={
        !adding && (
          <button onClick={() => setAdding(true)} className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold ring-1 ring-line hover:bg-paper">
            <UserPlus className="h-4 w-4" /> Ekle
          </button>
        )
      }
    >
      {adding && (
        <form
          className="mb-3 grid gap-2.5 rounded-xl bg-paper p-3 ring-1 ring-line"
          onSubmit={(e) => {
            e.preventDefault();
            let ok = false;
            run((s) => {
              const out = addStaff(s, { name, pin, role }, me.id);
              ok = out.result.ok;
              return out;
            }, `${name.trim()} eklendi.`);
            if (ok) {
              setAdding(false);
              setName("");
              setPin("");
              setRole("staff");
            }
          }}
        >
          <label htmlFor="st-name" className="sr-only">
            Ad
          </label>
          <input id="st-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad soyad" className={`${inputCls} bg-white`} autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <label htmlFor="st-pin" className="sr-only">
              4 haneli PIN
            </label>
            <input
              id="st-pin"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="4 haneli PIN"
              className={`${inputCls} bg-white tabular tracking-[0.2em]`}
              autoComplete="off"
            />
            <label htmlFor="st-role" className="sr-only">
              Rol
            </label>
            <select id="st-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={`${inputCls} bg-white`}>
              <option value="staff">{ROLE_LABEL.staff}</option>
              <option value="admin">{ROLE_LABEL.admin}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Btn tone="ghost" onClick={() => setAdding(false)}>
              Vazgeç
            </Btn>
            <Btn type="submit" tone="dark" disabled={name.trim().length < 2 || pin.length !== 4}>
              Ekle
            </Btn>
          </div>
        </form>
      )}
      <ul className="divide-y divide-line">
        {state.staff.map((s) => (
          <li key={s.id} className={`flex min-h-14 items-center gap-3 py-2 ${s.active ? "" : "opacity-55"}`}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold">
                {s.name}
                {s.id === me.id && <span className="font-normal text-muted"> (siz)</span>}
              </div>
              <div className="flex items-center gap-1.5 text-[13px] text-muted">
                {ROLE_LABEL[s.role]} · PIN <span className="tabular">{show === s.id ? s.pin : "••••"}</span>
                <button onClick={() => setShow(show === s.id ? null : s.id)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-paper" aria-label={show === s.id ? "PIN'i gizle" : "PIN'i göster"}>
                  {show === s.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {s.id !== me.id && (
              <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-muted">
                <span className="hidden sm:inline">{s.active ? "Erişim açık" : "Kapalı"}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={s.active}
                  onChange={(e) => run((st) => setStaffActive(st, s.id, e.target.checked, me.id), `${s.name} erişimi ${e.target.checked ? "açıldı" : "kapatıldı"}.`)}
                  className="peer sr-only"
                  aria-label={`${s.name} erişimi`}
                />
                <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-char ${s.active ? "bg-ok" : "bg-line"}`}>
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${s.active ? "left-6" : "left-1"}`} />
                </span>
              </label>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[13px] text-muted">Erişimi kapatılan personel PIN ile giriş yapamaz; açık oturumu hemen kapanır.</p>
    </Panel>
  );
}
