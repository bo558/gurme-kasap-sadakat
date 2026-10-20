import { ArrowRight, ScanLine, Settings, Smartphone } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { brand } from "./brand";
import { asset, BrandLogo, SinceRule } from "./components/brand";
import { CustomerApp } from "./customer/CustomerApp";
import { KasaApp } from "./panel/Kasa";
import { YonetimApp } from "./panel/Yonetim";
import { useRoute } from "./store/store";

export default function App() {
  const [parts, go] = useRoute();
  const [area] = parts;
  // Eski panel bağlantıları kasaya yönlenir.
  useEffect(() => {
    if (area === "panel") go("kasa");
  }, [area, go]);
  return (
    <>
      <DemoBar />
      {area === "app" ? <CustomerApp go={go} /> : area === "kasa" || area === "panel" ? <KasaApp go={go} /> : area === "yonetim" ? <YonetimApp go={go} /> : <Landing go={go} />}
    </>
  );
}

/** Tüm ekranlarda görünen demo uyarısı. Yüksekliği --demo-bar değişkeniyle düzende hesaba katılır. */
function DemoBar() {
  return (
    <div role="note" className="sticky top-0 z-[90] flex h-[var(--demo-bar)] items-center justify-center gap-2 bg-char px-3 text-center text-[11px] font-semibold leading-tight text-paper">
      <span className="rounded bg-kasap px-1.5 py-px tracking-[0.12em] text-white">DEMO</span>
      <span className="min-w-0 truncate sm:hidden">Gerçek uygulama değil · Bilgiler gönderilmez</span>
      <span className="hidden min-w-0 truncate sm:inline">Gerçek Gurme Kasap Burger uygulaması değildir · Girilen bilgiler hiçbir yere gönderilmez, yalnızca bu tarayıcıda kalır</span>
    </div>
  );
}

function Landing({ go }: { go: (p: string) => void }) {
  return (
    <div className="paper-grain min-h-[calc(100%-var(--demo-bar))] px-4 py-8 sm:px-8">
      <div className="mx-auto grid min-h-[calc(100dvh-90px)] max-w-5xl content-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] md:items-center">
        <div className="flex min-w-0 flex-col gap-7">
          <BrandLogo height={84} />
          <div>
            <SinceRule className="max-w-xs" text="Sadakat uygulaması · demo" />
            <h1 className="t-display mt-3 text-[clamp(38px,6vw,60px)] leading-[1.02]">
              Her siparişe
              <br />
              <em className="font-semibold text-kasap">bir damga.</em>
            </h1>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted">
              Müşteri uygulaması ve kasayı aynı tarayıcıda iki sekmede açın: kasada verilen damga, müşteri kartında anında görünür. Veriler yalnızca bu tarayıcıda tutulur; telefon ile tablet arasında paylaşılmaz. Gerçek SMS, kamera ile QR okutma ve veritabanı yoktur.
            </p>
          </div>
          <div className="grid max-w-xl gap-2.5">
            <Choice onClick={() => go("app")} icon={<Smartphone className="h-6 w-6" />} title="Müşteri uygulaması" sub="Kart, damgalar ve QR kod tek ekranda" primary />
            <Choice onClick={() => go("kasa")} icon={<ScanLine className="h-6 w-6 text-kasap" />} title="Kasa" sub="QR okut, tek dokunuşla damga ya da ödül" />
            <Choice onClick={() => go("yonetim")} icon={<Settings className="h-6 w-6 text-kasap" />} title="Yönetim" sub="Müşteri düzeltme, personel, program" />
          </div>
          <p className="text-[12px] text-muted">
            Logo ve fotoğraflar {brand.website} sitesinden alınmıştır · kullanım izni doğrulanmamıştır.
          </p>
        </div>
        <figure className="relative hidden md:block">
          <img src={asset(brand.images.hero.src)} alt={brand.images.hero.alt} className="aspect-[3/4] w-full rounded-[28px] object-cover shadow-[0_30px_60px_-30px_rgba(29,29,27,0.6)]" />
          <img src={asset(brand.heritage.src)} alt={brand.heritage.alt} className="absolute -bottom-8 -left-10 w-36 drop-shadow-[0_10px_18px_rgba(29,29,27,0.25)]" />
          <figcaption className="t-script absolute -top-10 right-1 rotate-[-4deg] text-[30px] text-kasap-deep">{brand.tagline}</figcaption>
        </figure>
      </div>
    </div>
  );
}

function Choice({ onClick, icon, title, sub, primary }: { onClick: () => void; icon: ReactNode; title: string; sub: string; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-4 rounded-2xl p-4 text-left transition-colors ${primary ? "bg-kasap text-white hover:bg-kasap-deep" : "bg-card text-char ring-1 ring-line hover:ring-char/30"}`}
    >
      {icon}
      <span className="flex-1">
        <span className="t-h1 block text-[19px]">{title}</span>
        <span className={`mt-0.5 block text-[14px] ${primary ? "text-white/85" : "text-muted"}`}>{sub}</span>
      </span>
      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
    </button>
  );
}
