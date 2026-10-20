import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { brand } from "../brand";
import { asset, BrandLogo, SinceRule } from "../components/brand";
import { findByPhone, registerCustomer } from "../data/engine";
import { useStore } from "../store/store";

type Step = "phone" | "otp" | "name";
const DEMO_OTP = "123456";
const MAX_TRIES = 5;

const fieldCls = "rounded-2xl bg-card ring-1 ring-line focus-within:ring-2 focus-within:ring-kasap";
const primaryBtn =
  "flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-kasap text-[15px] font-bold text-white transition-colors hover:bg-kasap-deep active:scale-[0.98] disabled:bg-paper-2 disabled:text-muted";

/** Giriş: telefon → SMS kodu → (yeni üyeyse) ad. Kayıtlı numara koddan sonra doğrudan karta gider. */
export function Onboarding() {
  const { state, update, loginDemo, toast } = useStore();
  const [step, setStep] = useState<Step>("phone");
  const [digits, setDigits] = useState("");
  const [otp, setOtp] = useState("");
  const [tries, setTries] = useState(0);
  const [otpError, setOtpError] = useState("");
  const [name, setName] = useState("");
  const [kvkk, setKvkk] = useState(false);
  const r = state.rules;
  const phoneOk = /^5\d{9}$/.test(digits);
  const fmt = (d: string) => [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(" ");
  const phone = `+90${digits}`;

  const verify = () => {
    if (otp !== DEMO_OTP) {
      const n = tries + 1;
      setTries(n);
      setOtp("");
      if (n >= MAX_TRIES) {
        setStep("phone");
        setTries(0);
        setOtpError("");
        toast("Çok fazla hatalı deneme. Numaranı kontrol edip yeni kod iste.", "bad");
      } else setOtpError(`Kod hatalı. ${MAX_TRIES - n} deneme hakkın kaldı.`);
      return;
    }
    const existing = findByPhone(state, phone);
    if (existing) {
      update((s) => ({ ...s, session: { ...s.session, customerId: existing.id } }));
      toast(`Tekrar hoş geldin ${existing.name.split(" ")[0]}!`);
    } else setStep("name");
  };

  if (step === "phone")
    return (
      <div className="paper-grain flex min-h-full flex-col">
        <div className="flex shrink-0 justify-center pt-[max(16px,env(safe-area-inset-top))]">
          <BrandLogo height={58} />
        </div>
        <div className="relative mx-4 mt-4 h-[clamp(150px,24dvh,230px)] shrink-0 overflow-hidden rounded-[24px]">
          <img src={asset(brand.images.hero.src)} alt={brand.images.hero.alt} className="h-full w-full object-cover object-[50%_45%]" />
          <img src={asset(brand.heritage.src)} alt={brand.heritage.alt} className="absolute bottom-2 right-2 w-[74px] drop-shadow-[0_4px_10px_rgba(29,29,27,0.3)]" />
        </div>
        <form
          className="flex flex-1 flex-col px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (phoneOk) {
              setOtp("");
              setOtpError("");
              setStep("otp");
            }
          }}
        >
          <SinceRule />
          <h1 className="t-display mt-3 text-[32px]">
            Her siparişe <em className="text-kasap">bir damga.</em>
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {r.stampsRequired} damgayı doldur, <b className="font-bold text-char">{r.rewardName}</b> bizden.
          </p>

          <label htmlFor="ob-phone" className="t-label mt-6 text-muted">
            Cep telefonun
          </label>
          <div className={`mt-2 flex h-14 items-center gap-2.5 px-4 ${fieldCls}`}>
            <span className="text-[16px] font-semibold text-muted">+90</span>
            <input
              id="ob-phone"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="5•• ••• •• ••"
              value={fmt(digits)}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").replace(/^0/, "").slice(0, 10))}
              className="h-full min-w-0 flex-1 bg-transparent text-[18px] font-bold tracking-wider outline-none tabular placeholder:text-char/25 focus-visible:outline-none"
            />
          </div>
          {digits.length > 0 && !phoneOk && <p className="mt-2 text-[13px] font-medium text-bad">5 ile başlayan 10 haneli numaranı gir.</p>}

          <div className="mt-auto grid gap-2.5 pt-6">
            <button type="submit" disabled={!phoneOk} className={primaryBtn}>
              Kod gönder <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-center text-[13px] text-muted">
              Demo: SMS gönderilmez.{" "}
              <button type="button" onClick={() => setDigits("5000000099")} className="font-bold text-char underline underline-offset-4">
                Örnek numara
              </button>{" "}
              ·{" "}
              <button type="button" onClick={loginDemo} className="font-bold text-char underline underline-offset-4">
                Örnek üye ile gir
              </button>
            </p>
          </div>
        </form>
      </div>
    );

  if (step === "otp")
    return (
      <Shell title="Kodu gir" sub={`0${fmt(digits)} numarasına gönderilen 6 haneli kodu yaz.`} onBack={() => setStep("phone")}>
        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (otp.length === 6) verify();
          }}
        >
          <OtpInput
            value={otp}
            onChange={(v) => {
              setOtp(v);
              setOtpError("");
            }}
          />
          {otpError && <p className="mt-2.5 text-[13px] font-medium text-bad">{otpError}</p>}
          <p className="mt-4 rounded-xl bg-gold-soft px-3.5 py-3 text-[13px] text-char ring-1 ring-gold/40">
            Demo: SMS gönderilmez. Kod <b className="tabular">{DEMO_OTP}</b>{" "}
            <button type="button" onClick={() => setOtp(DEMO_OTP)} className="ml-1 font-bold text-kasap-deep underline underline-offset-4">
              doldur
            </button>
          </p>
          <div className="mt-auto pt-6">
            <button type="submit" disabled={otp.length < 6} className={primaryBtn}>
              Doğrula <Check className="h-4 w-4" />
            </button>
          </div>
        </form>
      </Shell>
    );

  return (
    <Shell title="Adın ne?" sub="Kasada seni adınla karşılayalım." onBack={() => setStep("otp")}>
      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length < 2 || !kvkk) return;
          update((s) => {
            const out = registerCustomer(s, { name, phone });
            return { ...out.state, session: { ...out.state.session, customerId: out.customer.id } };
          });
          toast("Kartın hazır! İlk siparişinde QR'ını okut.");
        }}
      >
        <label htmlFor="ob-name" className="sr-only">
          Ad soyad
        </label>
        <input
          id="ob-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Adın ve soyadın"
          autoComplete="name"
          autoFocus
          className="h-14 rounded-2xl bg-card px-4 text-[16px] font-semibold outline-none ring-1 ring-line placeholder:text-char/35 focus:ring-2 focus:ring-kasap focus-visible:outline-none"
        />
        <label htmlFor="ob-kvkk" className="mt-4 flex cursor-pointer items-start gap-3 text-[14px] leading-relaxed">
          <input id="ob-kvkk" type="checkbox" checked={kvkk} onChange={(e) => setKvkk(e.target.checked)} className="peer sr-only" />
          <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-kasap ${kvkk ? "bg-kasap text-white" : "bg-card ring-[1.5px] ring-char/35"}`}>
            {kvkk && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          </span>
          <span>
            <b className="font-bold">KVKK Aydınlatma Metni</b>'ni okudum. <span className="text-muted">(Demo: metin taslak aşamasında.)</span>
          </span>
        </label>
        <div className="mt-auto pt-6">
          <button type="submit" disabled={name.trim().length < 2 || !kvkk} className={primaryBtn}>
            Kartımı oluştur <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </Shell>
  );
}

function Shell({ title, sub, onBack, children }: { title: string; sub: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="paper-grain flex min-h-full flex-col px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="-ml-2 grid h-11 w-11 place-items-center rounded-full hover:bg-paper-2" aria-label="Geri">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <BrandLogo height={34} />
        <span className="w-9" aria-hidden />
      </div>
      <h1 className="t-display mt-6">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{sub}</p>
      <div className="mt-7 flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <label className="relative block" htmlFor="ob-otp">
      <input
        ref={ref}
        id="ob-otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="absolute inset-0 opacity-0"
        aria-label="Doğrulama kodu"
      />
      <div className="grid grid-cols-6 gap-2" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`t-num grid h-14 place-items-center rounded-xl bg-card text-[26px] ring-1 ${i === value.length ? "ring-2 ring-kasap" : "ring-line"}`}>
            {value[i] ?? ""}
          </div>
        ))}
      </div>
    </label>
  );
}
