import { ChevronDown, ExternalLink, Gift, LogOut, Maximize2, RotateCcw, ScanLine, Settings2, Trash2, Wand2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { brand } from "../brand";
import { asset, BrandLogo, QrImage, Sheet, SinceRule, StampCard, Toasts } from "../components/brand";
import { COOLDOWN_MINUTES, DEMO_STAFF_ID, REWARD_VALID_DAYS } from "../data/defaults";
import {
  availableGrants,
  backupCode,
  balanceOf,
  daysLeft,
  deleteCustomer,
  earnStamp,
  firstName,
  fmtDate,
  initials,
  maskPhone,
  qrPayload,
  qrWindow,
  QR_WINDOW_MS,
} from "../data/engine";
import type { Customer } from "../data/types";
import { useStore } from "../store/store";
import { Onboarding } from "./Onboarding";

export function CustomerApp({ go }: { go: (p: string) => void }) {
  return (
    <div className="min-h-[calc(100%-var(--demo-bar))] bg-paper-2 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-10 lg:px-8 lg:py-8">
      <aside className="hidden lg:block lg:justify-self-end">
        <SideInfo />
      </aside>
      <div className="relative h-[calc(100dvh-var(--demo-bar))] w-full overflow-hidden bg-paper lg:h-[min(860px,calc(100dvh-64px-var(--demo-bar)))] lg:w-[400px] lg:rounded-[48px] lg:ring-[10px] lg:ring-char lg:shadow-[0_40px_100px_-36px_rgba(29,29,27,0.6)]">
        <AppInner go={go} />
      </div>
      <aside className="hidden lg:block">
        <DemoDock go={go} />
      </aside>
    </div>
  );
}

function AppInner({ go }: { go: (p: string) => void }) {
  const { state, update, toast } = useStore();
  const me = state.customers.find((c) => c.id === state.session.customerId);
  const [account, setAccount] = useState(false);
  const [demo, setDemo] = useState(false);
  const fresh = useCardEvents(me);
  // Üye değişince (çıkış, başka üyeyle giriş) açık paneller kapanır.
  useEffect(() => {
    setAccount(false);
    setDemo(false);
  }, [me?.id]);

  if (!me)
    return (
      <div className="no-scrollbar h-full overflow-y-auto">
        <Onboarding />
        <div className="absolute inset-x-0 top-0 z-[60]">
          <Toasts />
        </div>
      </div>
    );

  const newGrant = state.grants.find((g) => g.customerId === me.id && g.status !== "void" && !state.session.seenGrantIds.includes(g.id));
  const markSeen = (id: string) => update((s) => ({ ...s, session: { ...s.session, seenGrantIds: [...s.session.seenGrantIds, id] } }));

  return (
    <div className="paper-grain relative flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between px-4 pb-1 pt-[max(12px,env(safe-area-inset-top))]">
        <BrandLogo height={40} />
        <div className="flex items-center gap-2">
          <button onClick={() => setDemo(true)} className="flex h-9 items-center gap-1.5 rounded-full bg-card px-3 text-[12px] font-bold text-kasap-deep ring-1 ring-line lg:hidden" aria-label="Demo kontrollerini aç">
            <Wand2 className="h-3.5 w-3.5" /> Demo
          </button>
          <button onClick={() => setAccount(true)} className="grid h-10 w-10 place-items-center rounded-full bg-char font-display text-[15px] font-semibold text-paper" aria-label="Hesabım">
            {initials(me.name)}
          </button>
        </div>
      </header>
      <main className="no-scrollbar flex-1 overflow-y-auto">
        <CardScreen me={me} freshIndex={fresh} />
      </main>

      {account && <AccountSheet me={me} onClose={() => setAccount(false)} />}
      {demo && (
        <Sheet label="Demo kontrolleri" onClose={() => setDemo(false)}>
          <DemoActions go={go} onDone={() => setDemo(false)} />
        </Sheet>
      )}
      {newGrant && <Celebration rewardName={newGrant.rewardName} onClose={() => (markSeen(newGrant.id), toast("Ödülün QR ekranında seni bekliyor."))} />}
      <div className="absolute inset-x-0 top-0 z-[60]">
        <Toasts />
      </div>
    </div>
  );
}

/** Damga eklenince kartta animasyon ve kısa bildirim; ödül kullanılınca "afiyet olsun". */
function useCardEvents(me: Customer | undefined) {
  const { state, toast } = useStore();
  const bal = me ? balanceOf(state, me.id) : 0;
  const avail = me ? availableGrants(state, me.id).map((g) => g.id) : [];
  const prev = useRef({ id: me?.id, bal, avail });
  const [fresh, setFresh] = useState<number | null>(null);
  const availKey = avail.join(",");

  useEffect(() => {
    const p = prev.current;
    prev.current = { id: me?.id, bal, avail };
    if (!me || p.id !== me.id) return;
    const gained = avail.filter((id) => !p.avail.includes(id)).length;
    const lost = state.grants.filter((g) => p.avail.includes(g.id) && !avail.includes(g.id));
    if (lost.some((g) => g.status === "void")) {
      toast("Kartında bir düzeltme yapıldı.", "info");
      return;
    }
    if (bal > p.bal && !gained) {
      toast(`+${bal - p.bal} damga! Kartın güncellendi.`);
      setFresh(bal - 1);
      const t = setTimeout(() => setFresh(null), 1200);
      return () => clearTimeout(t);
    }
    if (lost.some((g) => g.status === "redeemed")) toast("Afiyet olsun! Ödülün kullanıldı.");
    else if (bal < p.bal && !gained) toast("Kartında bir düzeltme yapıldı.", "info");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, bal, availKey]);
  return fresh;
}

/* ---------------- KARTIM: kart + QR tek ekranda ---------------- */
function CardScreen({ me, freshIndex }: { me: Customer; freshIndex: number | null }) {
  const { state } = useStore();
  const r = state.rules;
  const bal = balanceOf(state, me.id);
  const avail = availableGrants(state, me.id);
  const left = r.stampsRequired - bal;
  const [big, setBig] = useState(false);

  return (
    <div className="px-4 pb-8 pt-3">
      <p className="text-[14px] font-medium text-muted">Hoş geldin {firstName(me.name)}</p>
      <h1 className="t-display mt-0.5 text-balance">
        {avail.length > 0 ? (
          <>
            <em className="text-kasap">{avail[0]!.rewardName}</em> hazır!
          </>
        ) : left === 1 ? (
          <>
            Son <em className="text-kasap">1 damga</em> kaldı
          </>
        ) : (
          <>
            Menüne <em className="text-kasap">{left} damga</em> kaldı
          </>
        )}
      </h1>

      <div className="mt-4">
        <StampCard stamps={bal} required={r.stampsRequired} rewardName={r.rewardName} freshIndex={freshIndex} />
      </div>

      <QrCard me={me} onExpand={() => setBig(true)} rewardName={avail[0]?.rewardName} rewardCount={avail.length} rewardDays={avail[0] ? daysLeft(avail[0].expiresAt) : 0} />

      {big && <QrFull me={me} onClose={() => setBig(false)} />}
    </div>
  );
}

function useQrTick() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return { win: qrWindow(now), remain: QR_WINDOW_MS - (now % QR_WINDOW_MS) };
}

function QrCard({ me, onExpand, rewardName, rewardCount, rewardDays }: { me: Customer; onExpand: () => void; rewardName?: string; rewardCount: number; rewardDays: number }) {
  const { win, remain } = useQrTick();
  const code = backupCode(me.id, win);
  return (
    <section className="mt-4 overflow-hidden rounded-[20px] bg-white text-char ring-1 ring-line">
      {rewardName ? (
        <div className="flex items-center gap-3 bg-kasap px-4 py-3 text-white">
          <img src={asset(brand.images.reward)} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover ring-2 ring-white/80" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold">
              {rewardName} hazır{rewardCount > 1 ? ` · ${rewardCount} ödül` : ""}
            </div>
            <div className="text-[13px] text-white/85">Kasada bu QR'ı göster · son {rewardDays} gün</div>
          </div>
          <Gift className="h-5 w-5 shrink-0" />
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 pt-3.5">
          <span className="t-label text-muted">Kasada okut</span>
          <span className="text-[13px] text-muted">Sipariş başına 1 damga</span>
        </div>
      )}
      <button onClick={onExpand} className="group relative mx-auto mt-3 block" aria-label="QR kodunu büyüt">
        <QrImage value={qrPayload(me.id, win)} size={176} />
        <span className="absolute -right-7 bottom-0 grid h-7 w-7 place-items-center rounded-full bg-paper text-muted group-hover:text-char">
          <Maximize2 className="h-3.5 w-3.5" />
        </span>
      </button>
      <div className="px-4 pb-4 pt-2 text-center">
        <div className="t-num text-[30px] tracking-[0.12em]" aria-live="polite">
          {code.slice(0, 3)} {code.slice(3)}
        </div>
        <div className="text-[13px] text-muted">Okunmazsa bu kodu söyle · kod her dakika yenilenir</div>
        <div className="mx-auto mt-2.5 h-1 max-w-[176px] overflow-hidden rounded-full bg-paper-2" aria-hidden>
          <div className="h-full bg-kasap transition-[width] duration-1000 ease-linear" style={{ width: `${(remain / QR_WINDOW_MS) * 100}%` }} />
        </div>
      </div>
    </section>
  );
}

function QrFull({ me, onClose }: { me: Customer; onClose: () => void }) {
  const { win } = useQrTick();
  const code = backupCode(me.id, win);
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white px-6 text-center text-char" role="dialog" aria-modal aria-label="QR kodu" onClick={onClose}>
      <button onClick={onClose} className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full bg-paper" aria-label="Kapat">
        <X className="h-5 w-5" />
      </button>
      <BrandLogo height={56} />
      <div className="mt-3 text-[15px] font-bold">{me.name}</div>
      <div className="mt-5">
        <QrImage value={qrPayload(me.id, win)} size={260} />
      </div>
      <div className="t-num mt-4 text-[38px] tracking-[0.12em]">
        {code.slice(0, 3)} {code.slice(3)}
      </div>
      <p className="mt-2 text-[14px] text-muted">Ekran parlaklığını artırmak okutmayı hızlandırır.</p>
    </div>
  );
}

/* ---------------- HESAP (alt panel) ---------------- */
function AccountSheet({ me, onClose }: { me: Customer; onClose: () => void }) {
  const { state, update, toast } = useStore();
  const [open, setOpen] = useState<"rules" | "kvkk" | "delete" | null>(null);
  const r = state.rules;
  const toggle = (k: typeof open) => setOpen(open === k ? null : k);
  return (
    <Sheet label="Hesabım" onClose={onClose}>
      <div className="flex items-center gap-3 pr-10">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-char font-display text-[17px] font-semibold text-paper">{initials(me.name)}</div>
        <div className="min-w-0">
          <div className="t-h1 truncate">{me.name}</div>
          <div className="text-[13px] text-muted tabular">
            {maskPhone(me.phone)} · {fmtDate(me.joinedAt)}'den beri üye
          </div>
        </div>
      </div>
      <div className="mt-5 divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        <Row title="Program kuralları" onClick={() => toggle("rules")} open={open === "rules"}>
          <ul className="grid gap-1.5 text-[14px]">
            <li>• Her siparişte 1 damga kazanırsın.</li>
            <li>
              • {r.stampsRequired} damga = 1 {r.rewardName}.
            </li>
            <li>• Ödül, kart dolduktan sonra {REWARD_VALID_DAYS} gün geçerlidir ve bir kez kullanılır.</li>
            <li>• Damgaların silinmez.</li>
            <li>• Aynı siparişe ikinci damga verilmez ({COOLDOWN_MINUTES} dk bekleme).</li>
          </ul>
          <p className="mt-2.5 text-[13px] text-muted">Demo varsayımıdır; kampanya koşulları henüz Gurme Kasap Burger tarafından onaylanmamıştır.</p>
        </Row>
        <Row title="KVKK aydınlatma metni" onClick={() => toggle("kvkk")} open={open === "kvkk"}>
          <p className="text-[14px] text-muted">Hukuki metin hazırlanma aşamasında. Onay tarihin: {fmtDate(me.kvkkAt)}.</p>
        </Row>
        <button onClick={() => update((s) => ({ ...s, session: { ...s.session, customerId: null } }))} className="flex h-14 w-full items-center gap-3 px-4 text-left text-[15px] font-semibold">
          <LogOut className="h-4 w-4 text-muted" /> Çıkış yap
        </button>
        <Row title="Hesabımı sil" danger onClick={() => toggle("delete")} open={open === "delete"}>
          <p className="text-[14px] text-muted">Ad, telefon, damga ve ödüllerin silinir; bu işlem geri alınamaz. Demo: yalnızca bu tarayıcıdaki örnek veriden silinir.</p>
          <button
            onClick={() => {
              update((s) => deleteCustomer(s, me.id));
              toast("Hesabın silindi.", "info");
            }}
            className="mt-3 h-12 w-full rounded-xl bg-bad text-[15px] font-bold text-white"
          >
            Hesabımı kalıcı olarak sil
          </button>
        </Row>
      </div>
      <p className="t-script mt-5 text-center text-[24px] text-kasap-deep">{brand.tagline}</p>
    </Sheet>
  );
}

function Row({ title, onClick, open, danger, children }: { title: string; onClick: () => void; open: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <div>
      <button onClick={onClick} aria-expanded={open} className={`flex h-14 w-full items-center gap-3 px-4 text-left text-[15px] font-semibold ${danger ? "text-bad" : ""}`}>
        {danger ? <Trash2 className="h-4 w-4" /> : <Settings2 className="h-4 w-4 text-muted" />}
        <span className="flex-1">{title}</span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/* ---------------- KUTLAMA ---------------- */
function Celebration({ rewardName, onClose }: { rewardName: string; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-kasap text-white" role="dialog" aria-modal aria-label="Ödül kazandın">
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="animate-pop relative">
          <img src={asset(brand.images.hero.src)} alt="" className="h-40 w-40 rounded-full object-cover ring-[6px] ring-paper" />
          <span className="absolute -right-2 -top-1 grid h-12 w-12 rotate-12 place-items-center rounded-full bg-char text-[#e9c98a]">
            <Gift className="h-5 w-5" />
          </span>
        </div>
        <SinceRule className="mt-7 w-56" text="Kartın doldu" onDark />
        <h2 className="t-display mt-2 text-[40px]">
          {rewardName}
          <br />
          <em>bizden!</em>
        </h2>
        <p className="mt-3 max-w-[17rem] text-[15px] font-medium text-white/90">Bir sonraki siparişinde kasada QR'ını göstermen yeterli.</p>
      </div>
      <div className="relative px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <button onClick={onClose} className="h-14 w-full rounded-2xl bg-char text-[15px] font-bold text-white">
          Harika!
        </button>
      </div>
    </div>
  );
}

/* ---------------- DEMO ---------------- */
function useDemoActions() {
  const { state, update, reset, toast, loginDemo } = useStore();
  const me = state.customers.find((c) => c.id === state.session.customerId);
  const add = (n: number) =>
    update((s) => {
      let cur = s;
      for (let i = 0; i < n; i++) cur = earnStamp(cur, { customerId: me!.id, staffId: DEMO_STAFF_ID, ignoreCooldown: true }).state;
      return cur;
    });
  const fill = () => add(Math.max(1, state.rules.stampsRequired - balanceOf(state, me!.id)));
  const demoName = firstName(state.customers[0]?.name ?? "");
  return { me, add, fill, reset: () => (reset(), toast("Demo sıfırlandı.", "info")), loginDemo, demoName };
}

function DemoActions({ go, onDone }: { go: (p: string) => void; onDone?: () => void }) {
  const { me, add, fill, reset, loginDemo, demoName } = useDemoActions();
  const done = (fn: () => void) => () => (fn(), onDone?.());
  return (
    <div>
      <div className="t-label flex items-center gap-2 text-kasap-deep">
        <Wand2 className="h-4 w-4" /> Demo kontrolleri
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">Kısayollar bekleme süresini atlar ve işlem kaydına "Demo kısayolu" olarak yazılır.</p>
      <div className="mt-3 grid gap-2">
        {me ? (
          <>
            <DemoBtn onClick={done(() => add(1))}>+1 damga (kasada okutulmuş gibi)</DemoBtn>
            <DemoBtn onClick={done(fill)}>Kartı doldur → ödül</DemoBtn>
          </>
        ) : (
          <DemoBtn onClick={done(loginDemo)}>Örnek üye ile gir{demoName ? ` (${demoName})` : ""}</DemoBtn>
        )}
        <DemoBtn onClick={() => go("kasa")}>
          <ScanLine className="h-4 w-4" /> Kasa ekranına geç
        </DemoBtn>
        <a href="#/kasa" target="_blank" rel="noreferrer" className="flex h-11 items-center gap-2 rounded-xl px-3.5 text-[14px] font-semibold text-muted ring-1 ring-line hover:text-char">
          <ExternalLink className="h-4 w-4" /> Kasayı yeni sekmede aç (aynı tarayıcıda senkron)
        </a>
      </div>
      <button onClick={done(reset)} className="mt-4 flex items-center gap-2 text-[13px] font-bold text-muted hover:text-char">
        <RotateCcw className="h-3.5 w-3.5" /> Demoyu sıfırla
      </button>
    </div>
  );
}

function DemoBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="flex h-11 items-center gap-2 rounded-xl bg-paper px-3.5 text-left text-[14px] font-semibold text-char ring-1 ring-line hover:bg-char hover:text-paper">
      {children}
    </button>
  );
}

function SideInfo() {
  return (
    <div className="max-w-[300px]">
      <SinceRule text="Müşteri uygulaması · prototip" />
      <h1 className="t-display mt-3 text-[38px]">
        <em className="text-kasap">{brand.cardTitle}</em>
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-muted">Uygulama açılınca kart ve QR kod tek ekranda. Ödül kazanılınca aynı ekranda görünür; kasada aynı QR okutulur.</p>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">Tüm veriler örnektir ve yalnızca bu tarayıcıda saklanır. SMS, sunucu ve kasa bağlantısı yoktur.</p>
      <img src={asset(brand.heritage.src)} alt={brand.heritage.alt} className="mt-6 w-28 opacity-90" />
    </div>
  );
}

function DemoDock({ go }: { go: (p: string) => void }) {
  return (
    <div className="w-[270px] rounded-2xl bg-card p-4 ring-1 ring-line">
      <DemoActions go={go} />
    </div>
  );
}
