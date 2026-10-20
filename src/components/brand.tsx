import { Beef, Gift, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState, type ReactNode } from "react";
import { brand } from "../brand";
import { useStore } from "../store/store";

/** public/ altındaki dosyalar için yol: uygulama hangi alt yoldan sunulursa sunulsun çalışır. */
export const asset = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\/+/, "")}`;

/** Orijinal logo (şeffaf zemin, oran korunur). Siyah harfler nedeniyle yalnızca açık zeminde kullanılır. */
export function BrandLogo({ height = 40, className = "" }: { height?: number; className?: string }) {
  const width = Math.round(height * brand.logo.ratio);
  return (
    <img
      src={asset(brand.logo.src)}
      width={width}
      height={height}
      alt={brand.logo.alt}
      className={`block shrink-0 select-none object-contain ${className}`}
      style={{ width, height }}
      draggable={false}
    />
  );
}

/** "1935'ten bu yana" mühür satırı: altın çizgiler arasında küçük etiket. */
export function SinceRule({ className = "", text = brand.since, onDark }: { className?: string; text?: string; onDark?: boolean }) {
  const line = `h-px flex-1 ${onDark ? "bg-white/40" : "bg-gold/45"}`;
  return (
    <div className={`flex items-center gap-2.5 ${onDark ? "text-white/85" : "text-gold-ink"} ${className}`}>
      <span className={line} aria-hidden />
      <span className="t-label whitespace-nowrap">{text}</span>
      <span className={line} aria-hidden />
    </div>
  );
}

/**
 * Dijital damga kartı: krem kasap kâğıdı, altın çift çerçeve, kırmızı mürekkep damgalar
 * ve delikli fiş kenarının altında kömür rengi ödül şeridi.
 */
export function StampCard({
  stamps,
  required,
  rewardName,
  name,
  freshIndex,
  compact,
}: {
  stamps: number;
  required: number;
  rewardName: string;
  name?: string;
  freshIndex?: number | null;
  compact?: boolean;
}) {
  const shown = Math.min(stamps, required);
  const cols = required <= 5 ? required : Math.ceil(required / 2);
  const left = Math.max(0, required - shown);
  return (
    <div className="relative overflow-hidden rounded-[20px] bg-card text-char shadow-[0_18px_40px_-26px_rgba(29,29,27,0.55)]">
      <div className={`heritage-frame rounded-t-[20px] ${compact ? "px-4 pb-3 pt-3.5" : "px-4 pb-4 pt-4"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="t-label text-gold-ink">Özen Kasap · 1935</div>
            <div className="mt-1 font-display text-[22px] font-semibold italic leading-none tracking-[-0.01em]">{brand.cardTitle}</div>
            {name && <div className="mt-1.5 truncate text-[13px] font-medium text-muted">{name}</div>}
          </div>
          <div className={`t-num shrink-0 text-kasap ${compact ? "text-[30px]" : "text-[38px]"}`} aria-label={`${shown} / ${required} damga`}>
            {shown}
            <span className="text-[18px] text-muted/70">/{required}</span>
          </div>
        </div>

        <ol className={`grid ${compact ? "mt-3 gap-2" : "mt-4 gap-2.5"}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: required }, (_, i) => {
            const filled = i < shown;
            const next = i === shown;
            const rot = ((i * 41) % 19) - 9;
            return (
              <li key={i} className="mx-auto aspect-square w-full max-w-12">
                {filled ? (
                  <div
                    className={`grid h-full w-full place-items-center rounded-full bg-kasap text-card shadow-[inset_0_0_0_2.5px_var(--color-kasap),inset_0_0_0_4px_rgba(255,252,248,0.85)] ${freshIndex === i ? "animate-stamp" : ""}`}
                    style={{ transform: `rotate(${rot}deg)`, ["--r" as string]: `${rot}deg` }}
                    aria-label={`${i + 1}. damga dolu`}
                  >
                    <Beef className="h-[50%] w-[50%]" strokeWidth={2.1} />
                  </div>
                ) : (
                  <div
                    className={`grid h-full w-full place-items-center rounded-full border-[1.5px] border-dashed ${next ? "border-kasap bg-kasap-soft" : "border-char/25"}`}
                    aria-label={`${i + 1}. damga boş`}
                  >
                    <span className={`font-display text-[14px] font-semibold ${next ? "text-kasap" : "text-char/35"}`}>{i + 1}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="perforation h-2 bg-card" aria-hidden />
      <div className={`flex items-center gap-2.5 bg-char px-4 text-paper ${compact ? "py-2.5" : "py-3"}`}>
        <Gift className="h-4 w-4 shrink-0 text-gold" />
        <div className="min-w-0 flex-1 truncate text-[13px]">
          <span className="font-semibold">{required} damga</span>
          <span className="text-paper/65"> = 1 {rewardName}</span>
        </div>
        <div className="shrink-0 text-[13px] font-bold text-[#e9c98a]">{left === 0 ? "Doldu" : `${left} kaldı`}</div>
      </div>
    </div>
  );
}

export function QrImage({ value, size = 208 }: { value: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: "M", color: { dark: "#1D1D1B", light: "#FFFFFF" } })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [value, size]);
  return src ? (
    <img src={src} width={size} height={size} alt="Kişisel QR kodu" className="block" style={{ imageRendering: "pixelated", width: size, height: size }} />
  ) : (
    <div style={{ width: size, height: size }} className="animate-pulse rounded bg-char/10" />
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--demo-bar)+max(10px,env(safe-area-inset-top)))] z-[100] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`animate-rise pointer-events-auto max-w-sm rounded-xl px-4 py-2.5 text-[14px] font-semibold shadow-lg ${
            t.tone === "ok" ? "bg-char text-paper" : t.tone === "bad" ? "bg-bad text-white" : "bg-white text-char ring-1 ring-line"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** Alttan açılan panel. `fixedTo="frame"`: telefon çerçevesinin içinde kalır. */
export function Sheet({ onClose, children, label, fixedTo = "frame" }: { onClose: () => void; children: ReactNode; label: string; fixedTo?: "frame" | "page" }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className={`${fixedTo === "frame" ? "absolute" : "fixed"} inset-0 z-50 flex items-end justify-center bg-char/55 backdrop-blur-[2px]`} onClick={onClose}>
      <div
        className="animate-rise no-scrollbar relative max-h-[90%] w-full max-w-lg overflow-y-auto rounded-t-[26px] bg-card p-5 pb-[max(20px,env(safe-area-inset-bottom))] text-char"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-label={label}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-char/15" />
        <button onClick={onClose} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-paper" aria-label="Kapat">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
