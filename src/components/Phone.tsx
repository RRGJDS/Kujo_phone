import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MEMOS, type MemoItem } from "./memos";
import { DIARIES, type DiaryItem } from "./diaries";
import { EmergencyModal } from "./EmergencyModal";


const AUTO_GALLERY_ENTRIES = import.meta.glob("../assets/gallery/*.{png,jpg,jpeg,webp}", {
  eager: true,
  import: "default"
}) as Record<string, string>;

const AUTO_GALLERY_URLS = Object.entries(AUTO_GALLERY_ENTRIES)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([, url]) => url);


const PUBLIC_GALLERY_FILENAMES: string[] = [
  
];


type ScreenState = "off" | "lock" | "passcode" | "home";


type AppId = "gallery" | "memo" | "diary" | "settings";
type HomeApp = { id: AppId; label: string; iconSrc: string };

const HOME_APPS: HomeApp[] = [
  { id: "gallery", label: "앨범", iconSrc: "/apps/app1.png" },
  { id: "memo", label: "메모", iconSrc: "/apps/app2.png" },
  { id: "diary", label: "일기", iconSrc: "/apps/app3.png" },
  { id: "settings", label: "설정", iconSrc: "/apps/app4.png" }
];


function fmtTime(d: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
}
function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(d);
}


const TARGET_SHA256_HEX =
  "e39eef82f61b21e2e7f762fcc4307358f165757f2e77ec855d6992f7e0191932"; 

function toHex(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(text: string) {
  if (crypto?.subtle?.digest) {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return toHex(digest);
  }
  return text === "1024" ? TARGET_SHA256_HEX : "x";
}
async function verifyPin(pin4: string) {
  const hash = await sha256Hex(pin4);
  return hash === TARGET_SHA256_HEX;
}


function SignalIcon() {
  return (
    <div className="flex items-end gap-[2px]" aria-label="signal">
      <div className="w-[3px] h-[4px] bg-white/90 rounded-[1px]" />
      <div className="w-[3px] h-[6px] bg-white/90 rounded-[1px]" />
      <div className="w-[3px] h-[8px] bg-white/90 rounded-[1px]" />
      <div className="w-[3px] h-[10px] bg-white/90 rounded-[1px]" />
    </div>
  );
}
function WifiIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 20 14" fill="none" aria-label="wifi">
      <path d="M2 4.5C6.9 0.5 13.1 0.5 18 4.5" stroke="rgba(255,255,255,.9)" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 7.5C8.3 4.9 11.7 4.9 15 7.5" stroke="rgba(255,255,255,.9)" strokeWidth="2" strokeLinecap="round" />
      <path d="M8.5 10.5C9.5 9.8 10.5 9.8 11.5 10.5" stroke="rgba(255,255,255,.9)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="12.2" r="1.2" fill="rgba(255,255,255,.9)" />
    </svg>
  );
}


function AppModal({
  open,
  title,
  onBack,
  onAfterClose,
  hideHeader,
  children,
  onOverlayPointerDown
}: {
  open: boolean;
  title: string;
  onBack: () => void;
  onAfterClose: () => void;
  hideHeader?: boolean;
  children: ReactNode;
  onOverlayPointerDown?: () => void;
}) {
  const DURATION = 260;

  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  const afterCloseRef = useRef(onAfterClose);
  useEffect(() => {
    afterCloseRef.current = onAfterClose;
  }, [onAfterClose]);

  useEffect(() => {
    let t: number | undefined;
    let raf1: number | undefined;
    let raf2: number | undefined;

    if (open) {
      setMounted(true);
      setVisible(false);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      t = window.setTimeout(() => {
        setMounted(false);
        afterCloseRef.current();
      }, DURATION);
    }

    return () => {
      if (t) window.clearTimeout(t);
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [open]);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 z-25">
      <div
        className={[
          "absolute inset-0 bg-black/45 backdrop-blur-sm",
          "transition-opacity duration-250 ease-out",
          visible ? "opacity-100" : "opacity-0"
        ].join(" ")}
        onPointerDown={() => onOverlayPointerDown?.()}
        onClick={onBack}
      />

      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          className={[
            "w-[92%] h-[92%] rounded-[28px] bg-white overflow-hidden",
            "shadow-[0_20px_60px_rgba(0,0,0,.35)]",
            "transition-all duration-250 ease-out",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          ].join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          {!hideHeader && (
            <div className="h-12 flex items-center gap-2 px-4 border-b border-black/10">
              <button
                className="w-8 h-8 rounded-xl grid place-items-center text-[22px] leading-none"
                onClick={onBack}
                aria-label="back"
              >
                ‹
              </button>
              <div className="font-extrabold">{title}</div>
            </div>
          )}

          <div className={hideHeader ? "h-full overflow-auto" : "h-[calc(100%-48px)] overflow-auto"}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
function GalleryApp({
  images,
  onCloseApp,
  onSetWallpaper,
  onResetWallpaper,
  onSound
}: {
  images: string[];
  onCloseApp: () => void;
  onSetWallpaper: (src: string) => void;
  onResetWallpaper: () => void;
  onSound: () => void;
}) {
  
  const DURATION = 260;
  const [viewerMounted, setViewerMounted] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const openViewer = (src: string) => {
    onSound();
    setViewerSrc(src);
    setViewerMounted(true);
    setViewerVisible(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setViewerVisible(true));
    });
  };

  const closeViewer = () => {
    onSound();
    setViewerVisible(false);
    window.setTimeout(() => {
      setViewerMounted(false);
      setViewerSrc(null);
      setSaved(false);
    }, DURATION);
  };

  const countText = `이미지 ${images.length}개`;

  return (
    <div className="relative h-full bg-white">
      
      <div className="h-14 px-4 flex items-center justify-between border-b border-black/10">
        <div>
          <div className="text-base font-extrabold">앨범</div>
          <div className="text-xs font-semibold text-black/45">{countText}</div>
        </div>

        
        <button
          className="w-8 h-8 rounded-xl border border-black/10 bg-black/5 font-black"
          onClick={() => {
            onSound();
            onCloseApp();
          }}
          aria-label="close-gallery"
        >
          ×
        </button>
      </div>

      
      <div className="h-[calc(100%-56px)] overflow-auto">
        {images.length === 0 ? (
          <div className="p-4">
            <div className="text-xs text-black/55 p-3 rounded-xl border border-black/10 bg-black/[0.03]">
              <div className="font-semibold mb-1">사진이 비어있어요</div>
              <div className="leading-relaxed">
                <div className="mb-2">
                  <b>자동 수집(추천)</b>: <code>src/assets/gallery</code> 폴더에 사진을 넣으세요.
                </div>
                <div>
                  <b>public/gallery 사용</b>: 코드 상단의 <code>PUBLIC_GALLERY_FILENAMES</code> 배열에 파일명을 추가해야 합니다.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-2 py-2">
            
            <div className="grid grid-cols-3 gap-[2px] bg-black/15 p-[2px]">
              {images.map((src) => (
                <button
                  key={src}
                  className="aspect-square bg-white overflow-hidden"
                  onClick={() => openViewer(src)}
                  title="사진 보기"
                >
                  <img src={src} className="w-full h-full object-cover" alt="thumb" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      
      {viewerMounted && (
        <div className="absolute inset-0 z-20">
          
          <div
            className={[
              "absolute inset-0 bg-white",
              "transition-opacity duration-300",
              viewerVisible ? "opacity-100" : "opacity-0"
            ].join(" ")}
          />

          
          <div
            className={[
              "absolute inset-0",
              "transition-all duration-300 ease-out",
              viewerVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-[0.98]"
            ].join(" ")}
          >
            
            <div className="h-14 px-4 flex items-center justify-between border-b border-black/10 bg-white">
              <div className="text-base font-extrabold">사진</div>

              <button
                className="w-8 h-8 rounded-xl border border-black/10 bg-black/5 font-black"
                onClick={closeViewer}
                aria-label="close-photo"
              >
                ×
              </button>
            </div>

            
            <div className="absolute top-14 bottom-20 left-0 right-0 p-0 bg-white">
              <img
                src={viewerSrc ?? ""}
                alt="selected"
                className={[
                  "w-full h-full object-contain",
                  "transition-transform duration-300",
                  viewerVisible ? "scale-[1.04]" : "scale-[1.01]"
                ].join(" ")}
              />
            </div>

            
            <div className="absolute left-0 right-0 bottom-0 p-4 border-t border-black/10 bg-white">
              <button
                className="w-full h-11 rounded-2xl bg-black text-white font-extrabold active:scale-[.99]"
                onClick={() => {
                  onSound();
                  if (!viewerSrc) return;
                  onSetWallpaper(viewerSrc);
                  setSaved(true);
                  window.setTimeout(() => setSaved(false), 900);
                }}
              >
                배경화면 설정
              </button>

              <button
                className="mt-2 w-full h-11 rounded-2xl bg-black/5 text-black font-extrabold active:scale-[.99]"
                onClick={() => {
                  onSound();
                  onResetWallpaper();
                }}
              >
                초기화(기본 배경으로)
              </button>

              <div className={["mt-2 text-center text-[11px] transition-opacity", saved ? "opacity-80" : "opacity-0"].join(" ")}>
                배경화면으로 설정되었습니다.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function MemoApp({ memos }: { memos: MemoItem[] }) {
  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-3">
        {memos.map((m) => (
          <div
            key={m.id}
            className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 shadow-[0_10px_25px_rgba(0,0,0,.08)]"
          >
            <div className="text-[11px] font-bold text-amber-900/80 mb-2">{m.date}</div>
            <div className="text-xs whitespace-pre-line leading-relaxed text-amber-950/90">{m.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


function DiaryApp({ diaries, onSound }: { diaries: DiaryItem[]; onSound: () => void }) {
  return (
    <div className="p-4">
      <div className="space-y-3">
        {diaries.map((d) => (
          <button
            key={d.id}
            className="w-full text-left rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-[0_10px_25px_rgba(0,0,0,.08)] active:scale-[.99]"
            onClick={() => {
              onSound();
              window.open(d.url, "_blank", "noopener,noreferrer");
            }}
            title="클릭하면 링크로 이동"
          >
            <div className="text-[11px] font-bold text-amber-900/80 mb-2">{d.date}</div>
            <div className="text-xs whitespace-pre-line leading-relaxed text-amber-950/90">{d.content}</div>
            <div className="mt-2 text-[11px] text-black/45">클릭 시 링크로 이동</div>
          </button>
        ))}
      </div>
    </div>
  );
}


type SettingRow = { key: string; value: string };

const SETTINGS: SettingRow[] = [
  { key: "이름", value: "기환석" },
  { key: "나이", value: "17세" },
  { key: "생년월일", value: "1월 12일" },
  { key: "신장", value: "184cm" },
  { key: "혈액형", value: "O형" },
  { key: "전화번호", value: "010-712X-XXXX" }
];

function SettingsApp({ rows }: { rows: SettingRow[] }) {
  return (
    <div className="bg-[#f1f2f5] h-full">
      <div className="h-12 bg-white" />
      <div className="bg-white">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between px-4 py-3 border-t border-black/5 text-sm">
            <div className="text-black/80">{r.key}</div>
            <div className="text-black/45">{r.value}</div>
          </div>
        ))}
      </div>
      <div className="text-center text-xs text-black/25 py-6">2026년 기준</div>
    </div>
  );
}

export function Phone() {
  const publicUrl = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\/+/, "")}`;

  const [screen, setScreen] = useState<ScreenState>("off");
  const [now, setNow] = useState(() => new Date());

  
  const DEFAULT_HOME_SRC = publicUrl("home.jpg");
  const DEFAULT_LOCK_SRC = publicUrl("lock.jpg");


  const [homeSrc, setHomeSrc] = useState<string>(DEFAULT_HOME_SRC);

  
  const galleryUrls = useMemo(() => {
    if (AUTO_GALLERY_URLS.length) return AUTO_GALLERY_URLS;
    return PUBLIC_GALLERY_FILENAMES.map((fn) => `/gallery/${fn}`);
  }, []);

  
  const [pin, setPin] = useState("");
  const pinRef = useRef(pin);
  useEffect(() => {
    pinRef.current = pin;
  }, [pin]);

  const verifyingRef = useRef(false);
  function setPinSafe(next: string) {
    pinRef.current = next;
    setPin(next);
  }

  const [hint, setHint] = useState(false);
  const [shake, setShake] = useState(false);

  
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const emergencyOpenRef = useRef(emergencyOpen);
  useEffect(() => {
    emergencyOpenRef.current = emergencyOpen;
  }, [emergencyOpen]);

  
  const [powerPressed, setPowerPressed] = useState(false);
  const resumeAfterUnlockRef = useRef<ScreenState>("home");

  
  const [appOpen, setAppOpen] = useState(false);
  const [appId, setAppId] = useState<AppId | null>(null);
  const appOpenRef = useRef(appOpen);
  useEffect(() => {
    appOpenRef.current = appOpen;
  }, [appOpen]);

  
  const outlineStyle = {
    textShadow:
      "0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, " +
      "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000"
  } as const;

  
  const audioRef = useRef<{ ctx: AudioContext; master: GainNode } | null>(null);

  function ensureAudio() {
    if (!audioRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AC();
      const master = ctx.createGain();
      master.gain.value = 0.18;
      master.connect(ctx.destination);
      audioRef.current = { ctx, master };
    }
    if (audioRef.current.ctx.state === "suspended") audioRef.current.ctx.resume();
  }

  function playClickSound() {
    try {
      ensureAudio();
      const { ctx, master } = audioRef.current!;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(1200, ctx.currentTime);

      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);

      osc.connect(g);
      g.connect(master);

      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch {
      
    }
  }

  
  const soundGateRef = useRef(false);
  function soundOnce() {
    if (soundGateRef.current) return;
    soundGateRef.current = true;
    playClickSound();
    requestAnimationFrame(() => {
      soundGateRef.current = false;
    });
  }

  
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  
  const screenRef = useRef(screen);
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    history.replaceState({ layer: "base" }, "");

    const onPop = (e: PopStateEvent) => {
      const layer = e.state?.layer ?? "base";

      
      if (layer === "passcode" && emergencyOpenRef.current) {
        setEmergencyOpen(false);
        setScreen("passcode");
        return;
      }

      
      if (layer === "base" && appOpenRef.current) {
        setAppOpen(false);
        return;
      }

      
      if (layer === "base" && screenRef.current === "passcode") {
        setEmergencyOpen(false);
        setPinSafe("");
        setHint(false);
        setScreen("lock");
        return;
      }
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    
  }, []);

  
  const dots = useMemo(() => [0, 1, 2, 3].map((i) => i < pin.length), [pin]);

  
  function onScreenClick() {
    soundOnce();

    if (screen === "off") return setScreen("lock");
    if (screen === "lock") return openPasscode();
  }

  
  function openPasscode() {
    soundOnce();
    setPinSafe("");
    setHint(false);
    setEmergencyOpen(false);
    setScreen("passcode");
    history.pushState({ layer: "passcode" }, "");
  }
  function closePasscode() {
    soundOnce();
    history.back();
  }

  
  function openEmergency() {
    soundOnce();
    setEmergencyOpen(true);
    history.pushState({ layer: "emergency" }, "");
  }
  function closeEmergency() {
    soundOnce();
    history.back();
  }

  
  async function appendDigit(d: string) {
    soundOnce();
    if (verifyingRef.current) return;

    const prev = pinRef.current;
    if (prev.length >= 4) return;

    const next = prev + d;
    setPinSafe(next);

    if (next.length === 4) {
      verifyingRef.current = true;
      const ok = await verifyPin(next);
      verifyingRef.current = false;

      if (ok) {
        setHint(false);
        setEmergencyOpen(false);
        setPinSafe("");

        setScreen(resumeAfterUnlockRef.current);
        history.replaceState({ layer: "base" }, "");
      } else {
        setHint(true);
        setShake(true);
        window.setTimeout(() => setShake(false), 350);
        window.setTimeout(() => setPinSafe(""), 550);
      }
    }
  }

  function deleteDigit() {
    soundOnce();
    if (verifyingRef.current) return;

    const prev = pinRef.current;
    if (!prev.length) return;
    setPinSafe(prev.slice(0, -1));
  }

  
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screenRef.current !== "passcode") return;

      if (e.key >= "0" && e.key <= "9") appendDigit(e.key);
      if (e.key === "Backspace") deleteDigit();
      if (e.key === "Escape") {
        if (emergencyOpenRef.current) closeEmergency();
        else closePasscode();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    
  }, []);

  
  function pressPowerButton() {
    soundOnce();
    setPowerPressed(true);
    window.setTimeout(() => setPowerPressed(false), 140);

    if (screen !== "off") {
      if (screen === "home") resumeAfterUnlockRef.current = "home";

      setAppOpen(false);
      setAppId(null);
      setEmergencyOpen(false);
      setPinSafe("");
      setHint(false);
      setShake(false);

      setScreen("off");
      history.replaceState({ layer: "base" }, "");
    } else {
      setEmergencyOpen(false);
      setPinSafe("");
      setHint(false);
      setShake(false);
      setScreen("lock");
    }
  }

  
  function openApp(id: AppId) {
    soundOnce();
    setAppId(id);
    setAppOpen(true);
    history.pushState({ layer: "app", app: id }, "");
  }
  function closeAppByBack() {
    soundOnce();
    history.back();
  }

  const clearAppId = () => setAppId(null);

  
  function renderApp() {
    if (!appId) return null;

    if (appId === "gallery") {
      return (
        <GalleryApp
          images={galleryUrls}
          onCloseApp={closeAppByBack}
          onSetWallpaper={(src) => setHomeSrc(src)}
          onResetWallpaper={() => setHomeSrc(DEFAULT_HOME_SRC)}
          onSound={soundOnce}
        />
      );
    }

    if (appId === "memo") return <MemoApp memos={MEMOS} />;
    if (appId === "diary") return <DiaryApp diaries={DIARIES} onSound={soundOnce} />;
    if (appId === "settings") return <SettingsApp rows={SETTINGS} />;

    return null;
  }

  const appTitle =
    appId === "gallery"
      ? "앨범"
      : appId === "memo"
        ? "메모"
        : appId === "diary"
          ? "일기"
          : appId === "settings"
            ? "설정"
            : "";


  return (
    <div className="min-h-screen bg-zinc-100 grid place-items-center p-6">
      
      <div className="relative overflow-visible w-[min(390px,86vw)] aspect-[9/19.5] scale-[1.25] origin-center">
        
        <button
          type="button"
          aria-label="power"
          onClick={(e) => {
            e.stopPropagation();
            pressPowerButton();
          }}
          className={[
            "absolute",
            "z-10",
            "right-[-10px]",
            "top-[140px]",
            "w-[14px] h-[86px]",
            "rounded-[10px]",
            "border border-black/10",
            "transition-transform duration-150 ease-out",
            powerPressed ? "-translate-x-[3px]" : "translate-x-0"
          ].join(" ")}
          style={{
            background: "linear-gradient(180deg, rgb(186,216,167) 0%, rgb(122,195,196) 100%)",
            boxShadow:
              "inset 3px 0 6px rgba(0,0,0,0.25), inset -1px 0 0 rgba(255,255,255,0.35), 0 6px 14px rgba(0,0,0,0.25)",
            filter: powerPressed ? "brightness(0.86)" : "brightness(0.92)"
          }}
        />

        
        <div
          className="relative z-20 w-full h-full rounded-[34px] shadow-[0_30px_80px_rgba(0,0,0,.35)] p-[14px]"
          style={{
            background: "linear-gradient(180deg, rgb(186,216,167) 0%, rgb(122,195,196) 100%)"
          }}
        >
          
          <div
            className="relative w-full h-full rounded-[24px] overflow-hidden bg-black cursor-pointer select-none"
            onClick={onScreenClick}
            
            onPointerDownCapture={(e) => {
              const el = e.target as HTMLElement;
              if (el.closest("button")) soundOnce();
            }}
          >
            
            {screen !== "off" && (
              <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
                <div className="h-7 bg-black/20" />
                <div className="absolute top-0 left-2 right-2 h-7 px-3 flex items-center justify-between text-[11px] font-semibold text-white/95">
                  <div className="tabular-nums">{fmtTime(now)}</div>

                  <div className="flex items-center gap-2">
                    <SignalIcon />
                    <WifiIcon />

                    <div className="flex items-center gap-1">
                      <span className="tabular-nums">59%</span>
                      <div className="relative w-[22px] h-[10px] rounded-[2px] border border-white/80">
                        <div className="absolute inset-[1px]">
                          <div className="h-full bg-white/90 rounded-[1px]" style={{ width: "59%" }} />
                        </div>
                        <div className="absolute -right-[3px] top-[3px] w-[3px] h-[4px] bg-white/80 rounded-[1px]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            
            <img
              src={DEFAULT_LOCK_SRC}
              alt="lock"
              className={[
                "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                screen === "lock" || screen === "passcode" ? "opacity-100" : "opacity-0"
              ].join(" ")}
            />

            
            <img
              src={homeSrc}
              alt="home"
              className={[
                "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                screen === "home" ? "opacity-100" : "opacity-0"
              ].join(" ")}
            />

            
            {screen === "home" && !appOpen && (
              <div className="absolute top-16 left-0 right-0 z-10 px-7">
                <div className="grid grid-cols-3 gap-x-6 gap-y-7">
                  {HOME_APPS.map((a) => (
                    <button
                      key={a.id}
                      className="flex flex-col items-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        openApp(a.id);
                      }}
                    >
                      <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-[0_10px_20px_rgba(0,0,0,.25)] bg-white/20">
                        <img src={a.iconSrc} alt={a.label} className="w-full h-full object-cover" />
                      </div>
                      <div className="text-[10px] font-semibold text-black/90">{a.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            
            <div
              className={[
                "absolute inset-0 bg-black transition-opacity duration-200",
                screen === "off" ? "opacity-100" : "opacity-0 pointer-events-none"
              ].join(" ")}
            />

            
            <div
              className={[
                "absolute top-[92px] left-0 right-0 text-center z-10 transition-all duration-200",
                screen === "lock" || screen === "passcode" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
              ].join(" ")}
            >
              <div className="text-[52px] font-extrabold leading-none text-white" style={outlineStyle}>
                {fmtTime(now)}
              </div>
              <div className="mt-2 text-[13px] font-semibold text-white/95" style={outlineStyle}>
                {fmtDate(now)}
              </div>
            </div>

            
            <div
              className={[
                "absolute bottom-4 left-0 right-0 text-center text-xs z-10 transition-opacity",
                screen === "off" || screen === "lock" ? "opacity-85" : "opacity-0 pointer-events-none"
              ].join(" ")}
            >
              화면을 클릭
            </div>

            
            <div
              className={["absolute inset-0 z-20", screen === "passcode" ? "pointer-events-auto" : "pointer-events-none"].join(" ")}
              onClick={(e) => e.stopPropagation()}
            >
              
              <div
                className={[
                  "absolute inset-0 bg-black/35 backdrop-blur-[14px]",
                  "transition-opacity duration-300 ease-out will-change-opacity",
                  screen === "passcode" ? "opacity-100" : "opacity-0"
                ].join(" ")}
              />

              
              <div
                className={[
                  "absolute inset-0",
                  "transition-all duration-300 ease-out will-change-transform will-change-opacity",
                  screen === "passcode" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                ].join(" ")}
              >
                
                <button
                  className="absolute top-12 left-4 w-10 h-10 rounded-2xl bg-white/10 border border-white/15 grid place-items-center font-black"
                  onClick={closePasscode}
                  aria-label="back"
                >
                  ‹
                </button>

                
                <div className="absolute top-28 left-0 right-0 grid place-items-center gap-3">
                  <div className={["text-xs text-white/90 h-5 transition-all", hint ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"].join(" ")}>
                    힌트: 2^10
                  </div>

                  <div className={["flex gap-3", shake ? "animate-[shake_.35s_ease]" : ""].join(" ")}>
                    {dots.map((filled, idx) => (
                      <div
                        key={idx}
                        className={[
                          "w-[10px] h-[10px] rounded-full border-2 border-white/90 transition",
                          filled ? "bg-white" : "bg-transparent"
                        ].join(" ")}
                      />
                    ))}
                  </div>
                </div>

                
                <div className="absolute bottom-5 left-0 right-0 px-6">
                  <div className="grid grid-cols-3 gap-3">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                      <button
                        key={d}
                        className="h-14 rounded-full bg-white/10 border border-white/15 text-white text-lg font-bold active:scale-[.98]"
                        onClick={() => appendDigit(d)}
                      >
                        {d}
                      </button>
                    ))}

                    
                    <button
                      className="h-14 rounded-full bg-white/10 border border-white/15 text-white text-xs font-extrabold active:scale-[.98]"
                      onClick={openEmergency}
                    >
                      긴급
                    </button>

                    <button
                      className="h-14 rounded-full bg-white/10 border border-white/15 text-white text-lg font-bold active:scale-[.98]"
                      onClick={() => appendDigit("0")}
                    >
                      0
                    </button>

                    <button
                      className="h-14 rounded-full bg-white/10 border border-white/15 text-white text-base font-extrabold active:scale-[.98]"
                      onClick={deleteDigit}
                      aria-label="delete"
                    >
                      ⌫
                    </button>
                  </div>
                </div>

                
                <EmergencyModal open={emergencyOpen} onClose={closeEmergency} />

                <style>{`
                  @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-8px); }
                    40% { transform: translateX(8px); }
                    60% { transform: translateX(-6px); }
                    80% { transform: translateX(6px); }
                  }
                `}</style>
              </div>
            </div>

            
            <AppModal
              open={appOpen && !!appId}
              title={appTitle}
              onBack={closeAppByBack}
              onAfterClose={clearAppId}
              
              hideHeader={appId === "gallery"}
              onOverlayPointerDown={soundOnce}
            >
              {renderApp()}
            </AppModal>
          </div>
        </div>
      </div>
    </div>
  );
}
