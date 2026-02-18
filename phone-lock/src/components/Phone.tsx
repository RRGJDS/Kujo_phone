import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MEMOS, type MemoItem } from "./memos";
import { DIARIES, type DiaryItem } from "./diaries";
import { SETTINGS, SettingsApp } from "./settings";
import { EmergencyModal } from "./EmergencyModal";

/**
 * ✅ Phone.tsx (갤러리 개선 + 효과음 강화 + Emergency 재연결 유지)
 *
 * 이번 반영 사항
 * 1) 갤러리:
 *    - 앨범(그리드): 메모의 back 버튼 스타일(‹)로 홈 이동
 *    - 사진(상세): "< 사진" 형태의 back 버튼(메모 스타일) + 드래그 이동/줌(레이아웃 찌그러짐 방지)
 * 2) "무언가를 클릭할 때마다" 효과음:
 *    - 폰 화면 내 버튼 클릭은 onPointerDownCapture로 자동 효과음
 *    - 화면 탭(OFF/LOCK ->) / 전원 버튼 등 버튼이 아닌 동작도 효과음
 * 3) 사진 상세보기: 확대(큰 화면) + 열기/닫기 부드러운 애니메이션
 * 4) 갤러리 자동 수집(가능):
 *    - ✅ 추천: src/assets/gallery 폴더에 넣으면 자동 수집(import.meta.glob)
 *    - (대안) public/gallery는 브라우저가 폴더 목록을 읽을 수 없어서 "자동"이 불가 → 빌드 단계에서 목록 생성 필요
 *
 * 파일 위치(권장):
 * - src/components/Phone.tsx
 * - src/components/memos.ts
 * - src/components/diaries.ts
 * - src/components/EmergencyModal.tsx
 *
 * 이미지:
 * - public/lock.jpg
 * - public/home.jpg
 * - public/apps/app1.png ~ app4.png
 *
 * 갤러리 자동 수집(추천):
 * - src/assets/gallery/ 에 .png/.jpg/.jpeg/.webp 파일 넣기
 */

// --------------------------------
// ✅ (추천) Vite 자동 갤러리 수집: src/assets/gallery/*
// - 여기에 파일만 넣으면 코드 수정 없이 자동으로 갤러리에 뜹니다.
// --------------------------------
const AUTO_GALLERY_ENTRIES = import.meta.glob("../assets/gallery/*.{png,jpg,jpeg,webp}", {
  eager: true,
  import: "default"
}) as Record<string, string>;

const AUTO_GALLERY_URLS = Object.entries(AUTO_GALLERY_ENTRIES)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([, url]) => url);

// --------------------------------
// (대안) public/gallery를 쓰고 싶다면:
// - 브라우저는 폴더 파일 목록을 "자동으로" 읽을 수 없음(보안/환경상 이유)
// - 그래서 여기 배열에 파일명을 수동으로 적어야 합니다.
// --------------------------------
const PUBLIC_GALLERY_FILENAMES: string[] = [
  // "a.jpg",
  // "b.png",
];

// 화면 상태
type ScreenState = "off" | "lock" | "passcode" | "home";

// 앱
type AppId = "gallery" | "memo" | "diary" | "settings";
type HomeApp = { id: AppId; label: string; iconSrc: string };

const HOME_APPS: HomeApp[] = [
  { id: "gallery", label: "앨범", iconSrc: "/apps/app1.png" },
  { id: "memo", label: "메모", iconSrc: "/apps/app2.png" },
  { id: "diary", label: "일기", iconSrc: "/apps/app3.png" },
  { id: "settings", label: "설정", iconSrc: "/apps/app4.png" }
];

// --------------------------------
// UI 크기 조절(여기만 바꾸면 1곳에서 계속 조절 가능)
// - 1.05 = 현재 기준 5% 확대
// --------------------------------
const UI_SCALE = 1.1025;

// 홈 화면 앱 아이콘/라벨 크기
const HOME_ICON_PX = Math.round(64 * UI_SCALE);      // 기본 64px(=w-16)
const HOME_LABEL_PX = Math.round(12 * UI_SCALE);     // 기본 10px

// 앱 헤더 타이틀/서브텍스트(앨범, 메모 등)
const APP_TITLE_PX = Math.round(16 * UI_SCALE);      // text-base(≈16px)
const APP_SUB_PX = Math.round(12 * UI_SCALE);        // text-xs(≈12px)

// --------------------------------
// 마우스 커서(32x32)
// - public 폴더에 아래 파일명을 맞춰 넣으면 바로 적용됨
//   예) public/cursor-default.png, public/cursor-down.png
// - 핫스팟(클릭 기준점)은 16,16(가운데)로 잡아둠. 필요하면 숫자만 바꿔.
// --------------------------------
const CURSOR_DEFAULT_SRC = `${import.meta.env.BASE_URL}cursor-default.png`;
const CURSOR_DOWN_SRC = `${import.meta.env.BASE_URL}cursor-down.png`;
const CURSOR_HOTSPOT_X = 16;
const CURSOR_HOTSPOT_Y = 16;


// 시간/날짜 (PC 로컬)
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

// PIN 검증
const TARGET_SHA256_HEX =
  "e39eef82f61b21e2e7f762fcc4307358f165757f2e77ec855d6992f7e0191932"; // sha256("1024")

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

// 상태바 아이콘(신호/와이파이)
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

// --------------------------------
// 공통: 앱 모달(아래→위 / 위→아래)
// - hideHeader=true면 상단 헤더를 숨김(갤러리는 자체 헤더 사용)
// --------------------------------
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
              <div className="font-extrabold" style={{ fontSize: APP_TITLE_PX }}>{title}</div>
            </div>
          )}

          <div className={hideHeader ? "h-full overflow-hidden" : "h-[calc(100%-48px)] overflow-auto"}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------
// 갤러리 앱
// 요구사항 반영
// 1) 갤러리 열기/스크롤 렉 최적화(배치 렌더 + lazy/async decode + content-visibility)
// 2) 확대/축소 시 이중 스크롤/찌그러짐 방지(단일 스크롤 + overflow 잠금 + transform 기반 zoom)
// 3) 메인 하단 "배경화면 초기화" 버튼 복원
// 4) 확대 사진 닫기(X) 버튼: 한 칸 아래 우측 상단
// 5) 메인 뒤로가기: 좌측 상단 "<"
// 6) 터치음 중복 방지: 갤러리 내부에서 별도 onSound 호출 제거(상위 캡처에서 1회만 재생)
// --------------------------------

// 썸네일 그리드(메모이즈)
const GalleryThumbGrid = memo(function GalleryThumbGrid({
  images,
  onOpen
}: {
  images: string[];
  onOpen: (src: string) => void;
}) {
  return (
    <div className="px-2 py-2">
      <div className="grid grid-cols-3 gap-[2px] bg-black/15 p-[2px]">
        {images.map((src) => (
          <button
            key={src}
            type="button"
            className="aspect-square bg-white overflow-hidden"
            style={{ ...( { contentVisibility: "auto", containIntrinsicSize: "120px 120px" } as any ) }}
            onClick={() => onOpen(src)}
            title="사진 보기"
          >
            <img
              src={src}
              className="w-full h-full object-cover"
              alt="thumb"
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </button>
        ))}
      </div>
    </div>
  );
});

function GalleryApp({
  images,
  onCloseApp,
  onSetWallpaper,
  onResetWallpaper
}: {
  images: string[];
  onCloseApp: () => void;
  onSetWallpaper: (src: string) => void;
  onResetWallpaper: () => void;
}) {
  const DURATION = 260;

  // 사진 상세 보기(애니메이션용 상태)
  const [viewerMounted, setViewerMounted] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // 확대/축소는 transform으로만 처리(레이아웃 변화로 인한 "찌그러짐" 방지)
  const [zoom, setZoom] = useState(1);
  // ✅ 드래그 이동(줌 상태에서만)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(pan);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const viewerAreaRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const clampPan = useCallback((x: number, y: number, z: number) => {
    const el = viewerAreaRef.current;
    if (!el) return { x, y };
    const w = el.clientWidth;
    const h = el.clientHeight;

    // object-contain 기준 완벽한 한계 계산은 복잡하므로,
    // "화면 크기 * (줌-1)/2"로 자연스러운 범위로 클램프합니다.
    const maxX = Math.max(0, (w * (z - 1)) / 2);
    const maxY = Math.max(0, (h * (z - 1)) / 2);

    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y))
    };
  }, []);

  const onPointerDownPan = useCallback((e: any) => {
    if (zoom <= 1.01) return;
    draggingRef.current = true;
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y
    };
    try {
      e.currentTarget?.setPointerCapture?.(e.pointerId);
    } catch {}
    e.preventDefault();
    e.stopPropagation();
  }, [zoom]);

  const onPointerMovePan = useCallback((e: any) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    const next = clampPan(dragStartRef.current.panX + dx, dragStartRef.current.panY + dy, zoom);
    setPan(next);

    e.preventDefault();
    e.stopPropagation();
  }, [clampPan, zoom]);

  const endPan = useCallback((e: any) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    try {
      e.currentTarget?.releasePointerCapture?.(e.pointerId);
    } catch {}
    e.preventDefault();
    e.stopPropagation();
  }, []);


  // ✅ 배치 렌더: 열 때 렉 감소
  const BATCH = 48;
  const [limit, setLimit] = useState(() => Math.min(images.length, BATCH));
  useEffect(() => {
    setLimit(Math.min(images.length, BATCH));
  }, [images.length]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const rootEl = listRef.current;

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) return;
        setLimit((prev) => (prev >= images.length ? prev : Math.min(images.length, prev + BATCH)));
      },
      {
        root: rootEl,
        rootMargin: "600px 0px",
        threshold: 0.01
      }
    );

    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [images.length]);

  const visibleImages = useMemo(() => images.slice(0, limit), [images, limit]);

  const openViewer = useCallback((src: string) => {
    setViewerSrc(src);
    setSaved(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });

    setViewerMounted(true);
    setViewerVisible(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setViewerVisible(true));
    });
  }, []);

  const closeViewer = useCallback(() => {
    setViewerVisible(false);
    window.setTimeout(() => {
      setViewerMounted(false);
      setViewerSrc(null);
      setSaved(false);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }, DURATION);
  }, []);

  const onWheelZoom = useCallback((e: any) => {
    // ✅ 뷰어에서 휠 이벤트가 바깥 스크롤로 전파되는 것을 차단(이중 스크롤 방지)
    e.preventDefault();
    e.stopPropagation();

    const delta = -e.deltaY * 0.0015; // 감도
    setZoom((z) => {
      const next = Math.min(3, Math.max(1, z + delta));
      const fixed = Number(next.toFixed(3));

      // 줌 변경 시 현재 pan도 자연스럽게 클램프
      setPan((p) => clampPan(p.x, p.y, fixed));

      // 거의 1이면 완전히 1로 스냅 + pan 초기화
      if (fixed <= 1.01) {
        setPan({ x: 0, y: 0 });
        return 1;
      }

      return fixed;
    });
  }, [clampPan]);

  const onDoubleZoom = useCallback(() => {
    setZoom((z) => {
      const next = z <= 1.01 ? 2.2 : 1;

      if (next <= 1.01) {
        setPan({ x: 0, y: 0 });
        return 1;
      }

      setPan((p) => clampPan(p.x, p.y, next));
      return next;
    });
  }, [clampPan]);

  const countText = `이미지 ${images.length}개`;

  return (
    <div className="relative h-full bg-white flex flex-col">
      {/* ✅ 메인 상단바: 좌측 "<" 뒤로가기 */}
      <div className="h-14 px-4 flex items-center gap-2 border-b border-black/10 shrink-0">
        <button
          type="button"
          className="w-8 h-8 rounded-xl grid place-items-center text-[22px] leading-none active:scale-[.99]"
          onClick={onCloseApp}
          aria-label="back-gallery"
        >
          ‹
        </button>

        <div className="min-w-0">
          <div className="font-extrabold text-black" style={{ fontSize: APP_TITLE_PX }}>앨범</div>
          <div className="font-semibold text-black/45" style={{ fontSize: APP_SUB_PX }}>{countText}</div>
        </div>

        <div className="flex-1" />
      </div>

      {/* ✅ 그리드: 뷰어 열려있을 때 스크롤 잠금(이중 스크롤 방지) */}
      <div
        ref={listRef}
        className={[
          "flex-1",
          viewerMounted ? "overflow-hidden" : "overflow-y-scroll",
          "bg-white"
        ].join(" ")}
        style={{
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          ...( { scrollbarGutter: "stable" } as any )
        }}
      >
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
          <>
            <GalleryThumbGrid images={visibleImages} onOpen={openViewer} />
            <div ref={sentinelRef} className="h-10" />
          </>
        )}
      </div>

      {/* ✅ 메인 하단: 배경화면 초기화 버튼 */}
      <div className="shrink-0 p-4 border-t border-black/10 bg-white">
        <button
          type="button"
          className="w-full h-11 rounded-2xl bg-black/5 text-black font-extrabold active:scale-[.99]"
          onClick={onResetWallpaper}
        >
          배경화면 초기화
        </button>
      </div>

      {/* ✅ 사진 상세 보기 오버레이 */}
      {viewerMounted && (
        <div className="absolute inset-0 z-20 overflow-hidden" style={{ overscrollBehavior: "none" }}>
          <div
            className={[
              "absolute inset-0 bg-white",
              "transition-opacity duration-300",
              viewerVisible ? "opacity-100" : "opacity-0"
            ].join(" ")}
          />

          <div
            className={[
              "absolute inset-0 flex flex-col",
              "transition-all duration-300 ease-out",
              viewerVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-[0.98]"
            ].join(" ")}
          >
            <div className="h-12 flex items-center gap-2 px-4 border-b border-black/10 bg-white shrink-0">
              <button
                type="button"
                className="w-8 h-8 rounded-xl grid place-items-center text-[22px] leading-none active:scale-[.99]"
                onClick={closeViewer}
                aria-label="back-photo"
              >
                ‹
              </button>
              <div className="font-extrabold text-black" style={{ fontSize: APP_TITLE_PX }}>앨범</div>
              <div className="flex-1" />
            </div>

            {/* 사진 영역: overflow-hidden + touchAction none */}
            <div
              ref={viewerAreaRef}
              className="relative flex-1 overflow-hidden bg-white"
              onWheel={onWheelZoom}
              onDoubleClick={onDoubleZoom}
              onPointerDown={onPointerDownPan}
              onPointerMove={onPointerMovePan}
              onPointerUp={endPan}
              onPointerCancel={endPan}
              style={{
                touchAction: "none",
                cursor: "inherit"
              }}
            >
              {viewerSrc && (
                <img
                  src={viewerSrc}
                  alt="selected"
                  className="absolute inset-0 w-full h-full object-contain select-none"
                  style={{
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                    transformOrigin: "center",
                    willChange: "transform",
                    transition: "transform 90ms ease-out"
                  }}
                  draggable={false}
                  decoding="async"
                />
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="shrink-0 p-4 border-t border-black/10 bg-white">
              <button
                type="button"
                className="w-full h-11 rounded-2xl bg-black text-white font-extrabold active:scale-[.99]"
                onClick={() => {
                  if (!viewerSrc) return;
                  onSetWallpaper(viewerSrc);
                  setSaved(true);
                  window.setTimeout(() => setSaved(false), 900);
                }}
              >
                배경화면 설정
              </button>

              <div className={["mt-2 text-center text-[11px] transition-opacity", saved ? "opacity-80" : "opacity-0"].join(" ")}>
                배경화면으로 설정되었습니다.
              </div>

              <div className="mt-2 text-center text-[11px] text-black/40">
                확대/축소: 마우스 휠 · 빠른 확대: 더블클릭 · 이동: 드래그
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 메모(2열)
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

// 일기(클릭 시 외부 링크)
// - 효과음은 상위(onPointerDownCapture)에서 1회 재생되도록 내부에서 별도 재생하지 않음(중복 방지)
function DiaryApp({ diaries }: { diaries: DiaryItem[] }) {
  return (
    <div className="p-4">
      <div className="space-y-3">
        {diaries.map((d) => (
          <button
            key={d.id}
            type="button"
            className="w-full text-left rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-[0_10px_25px_rgba(0,0,0,.08)] active:scale-[.99]"
            onClick={() => {
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

/* =========================================================
 *  Phone
 * ========================================================= */
export function Phone() {
  // 단계 상태
  const [screen, setScreen] = useState<ScreenState>("off");
  const [now, setNow] = useState(() => new Date());

  // 홈 배경(갤러리에서 변경 가능)
  const DEFAULT_HOME_SRC = "/home.jpg";
  const [homeSrc, setHomeSrc] = useState<string>(DEFAULT_HOME_SRC);

  // 자동 갤러리(추천) → 없으면 public/gallery 수동 목록 사용
  const galleryUrls = useMemo(() => {
    if (AUTO_GALLERY_URLS.length) return AUTO_GALLERY_URLS;
    return PUBLIC_GALLERY_FILENAMES.map((fn) => `/gallery/${fn}`);
  }, []);

  // PIN 입력
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

  // 긴급 연락처
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const emergencyOpenRef = useRef(emergencyOpen);
  useEffect(() => {
    emergencyOpenRef.current = emergencyOpen;
  }, [emergencyOpen]);

  // 전원 버튼
  const [powerPressed, setPowerPressed] = useState(false);
  const resumeAfterUnlockRef = useRef<ScreenState>("home");

  // 마우스 커서(기본/클릭)
  const [cursorDown, setCursorDown] = useState(false);

  // 앱 모달
  const [appOpen, setAppOpen] = useState(false);
  const [appId, setAppId] = useState<AppId | null>(null);
  const appOpenRef = useRef(appOpen);
  useEffect(() => {
    appOpenRef.current = appOpen;
  }, [appOpen]);

  // 잠금화면 큰 시간/날짜 외곽선(잠금화면에만)
  const outlineStyle = {
    textShadow:
      "0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, " +
      "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000"
  } as const;


  // 홈 앱 라벨(아이콘 아래 텍스트): 흰색 + 얇은 검정 외곽선(배경과 분리)
  const appLabelStyle = {
    textShadow:
      "0 1px 0 rgba(0,0,0,.75), 0 -1px 0 rgba(0,0,0,.75), 1px 0 0 rgba(0,0,0,.75), -1px 0 0 rgba(0,0,0,.75)"
  } as const;

  // 클릭음(WebAudio)
  const audioRef = useRef<{ ctx: AudioContext; master: GainNode } | null>(null);

  function ensureAudio() {
    if (!audioRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AC();
      const master = ctx.createGain();
      master.gain.value = 0.30;
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
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);

      osc.connect(g);
      g.connect(master);

      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch {
      // ignore
    }
  }

  // ✅ 효과음 중복 방지: pointerdown/click 등 연속 이벤트에서 1회만 재생되도록 게이트
  const soundLastAtRef = useRef(0);
  function soundOnce() {
    const t = performance.now();
    if (t - soundLastAtRef.current < 160) return;
    soundLastAtRef.current = t;
    playClickSound();
  }

  // 커서 클릭 상태: pointerup이 화면 밖에서 발생해도 복구되도록 window에 바인딩
  useEffect(() => {
    const up = () => setCursorDown(false);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("blur", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", up);
    };
  }, []);

  // 시간 갱신
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // 뒤로가기(popstate)
  const screenRef = useRef(screen);
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    history.replaceState({ layer: "base" }, "");

    const onPop = (e: PopStateEvent) => {
      const layer = e.state?.layer ?? "base";

      // emergency 닫기: emergency -> passcode
      if (layer === "passcode" && emergencyOpenRef.current) {
        setEmergencyOpen(false);
        setScreen("passcode");
        return;
      }

      // 앱 닫기: app -> base
      if (layer === "base" && appOpenRef.current) {
        setAppOpen(false);
        return;
      }

      // passcode 닫기: passcode -> base
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 점(4칸)
  const dots = useMemo(() => [0, 1, 2, 3].map((i) => i < pin.length), [pin]);

  // 화면 클릭: OFF -> LOCK -> PASSCODE
  function onScreenClick() {
    soundOnce();

    if (screen === "off") return setScreen("lock");
    if (screen === "lock") return openPasscode();
  }

  // PASSCODE 열기/닫기
  function openPasscode() {
    setPinSafe("");
    setHint(false);
    setEmergencyOpen(false);
    setScreen("passcode");
    history.pushState({ layer: "passcode" }, "");
  }
  function closePasscode() {
    history.back();
  }

  // 긴급 열기/닫기
  function openEmergency() {
    setEmergencyOpen(true);
    history.pushState({ layer: "emergency" }, "");
  }
  function closeEmergency() {
    history.back();
  }

  // PIN 입력
  async function appendDigit(d: string) {
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
    if (verifyingRef.current) return;

    const prev = pinRef.current;
    if (!prev.length) return;
    setPinSafe(prev.slice(0, -1));
  }

  // 키보드(ESC: emergency면 닫고, 아니면 passcode 닫기)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 전원 버튼
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

  // 앱 열기/닫기 (히스토리)
  function openApp(id: AppId) {
    setAppId(id);
    setAppOpen(true);
    history.pushState({ layer: "app", app: id }, "");
  }
  function closeAppByBack() {
    history.back();
  }

  const clearAppId = () => setAppId(null);

  // 앱 내용
  function renderApp() {
    if (!appId) return null;

    if (appId === "gallery") {
      return (
        <GalleryApp
          images={galleryUrls}
          onCloseApp={closeAppByBack}
          onSetWallpaper={(src) => setHomeSrc(src)}
          onResetWallpaper={() => setHomeSrc(DEFAULT_HOME_SRC)}
        />
      );
    }

    if (appId === "memo") return <MemoApp memos={MEMOS} />;
    if (appId === "diary") return <DiaryApp diaries={DIARIES} />;
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

  // ---------------------------------------------------------
  // JSX (폰 프레임/색/위치: 기존 유지)
  // ---------------------------------------------------------
  return (
    <div className="min-h-screen bg-zinc-100 grid place-items-center p-6">
      {/* wrapper: 전원 버튼을 '폰 뒤'로 보이게 하기 위해 프레임과 형제 구조 */}
      <div className="relative overflow-visible w-[min(451px,99vw)] aspect-[9.45/18.525] scale-[1.2] origin-center">
        {/* 전원 버튼(뒤쪽) */}
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
            "right-[-7px]",
            "top-[160px]",
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

        {/* 프레임(폰 본체) - 기존 디자인 유지 */}
        <div
          className="relative z-20 w-full h-full rounded-[34px] shadow-[0_30px_80px_rgba(0,0,0,.35)] p-[14px]"
          style={{
            background: "linear-gradient(180deg, rgb(186,216,167) 0%, rgb(122,195,196) 100%)"
          }}
        >
          {/* 폰 화면 */}
          <div
            className="relative w-full h-full rounded-[24px] overflow-hidden bg-black select-none customCursor"
            onClick={onScreenClick}
            style={{
              fontSize: `${16 * UI_SCALE}px`,
              cursor: cursorDown
                ? `url(${CURSOR_DOWN_SRC}) ${CURSOR_HOTSPOT_X} ${CURSOR_HOTSPOT_Y}, auto`
                : `url(${CURSOR_DEFAULT_SRC}) ${CURSOR_HOTSPOT_X} ${CURSOR_HOTSPOT_Y}, auto`
            }}
            // ✅ 버튼이면 자동 효과음(원하는 "전부 효과음"에 가장 가까움)
            onPointerDownCapture={(e) => {
              setCursorDown(true);
              const el = e.target as HTMLElement;
              if (el.closest("button")) soundOnce();
            }}
            onPointerUpCapture={() => setCursorDown(false)}
            onPointerCancelCapture={() => setCursorDown(false)}
          >
            {/* 상태바 */}
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

            {/* 잠금 배경 */}
            <img
              src="/lock.jpg"
              alt="lock"
              className={[
                "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                screen === "lock" || screen === "passcode" ? "opacity-100" : "opacity-0"
              ].join(" ")}
            />

            {/* 홈 배경 */}
            <img
              src={homeSrc}
              alt="home"
              className={[
                "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                screen === "home" ? "opacity-100" : "opacity-0"
              ].join(" ")}
            />

            {/* 홈 화면 앱 아이콘(3열 + 크기 확대) */}
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
                      <div className="rounded-2xl overflow-hidden shadow-[0_10px_20px_rgba(0,0,0,.25)] bg-white/20" style={{ width: HOME_ICON_PX, height: HOME_ICON_PX }}>
                        <img src={a.iconSrc} alt={a.label} className="w-full h-full object-cover" />
                      </div>
                      <div className="font-semibold text-white" style={{ ...appLabelStyle, fontSize: HOME_LABEL_PX }}>{a.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 초기 검정 화면 */}
            <div
              className={[
                "absolute inset-0 bg-black transition-opacity duration-200",
                screen === "off" ? "opacity-100" : "opacity-0 pointer-events-none"
              ].join(" ")}
            />

            {/* 잠금화면 큰 시간/날짜 */}
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

            {/* 안내 */}
            <div
              className={[
                "absolute bottom-4 left-0 right-0 text-center text-xs z-10 transition-opacity",
                screen === "off" || screen === "lock" ? "opacity-85" : "opacity-0 pointer-events-none"
              ].join(" ")}
            >
              화면을 클릭하세요
            </div>

            {/* PASSCODE 오버레이 */}
            <div
              className={["absolute inset-0 z-20", screen === "passcode" ? "pointer-events-auto" : "pointer-events-none"].join(" ")}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 배경 블러 */}
              <div
                className={[
                  "absolute inset-0 bg-black/35 backdrop-blur-[14px]",
                  "transition-opacity duration-300 ease-out will-change-opacity",
                  screen === "passcode" ? "opacity-100" : "opacity-0"
                ].join(" ")}
              />

              {/* 키패드 */}
              <div
                className={[
                  "absolute inset-0",
                  "transition-all duration-300 ease-out will-change-transform will-change-opacity",
                  screen === "passcode" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                ].join(" ")}
              >
                {/* 뒤로가기 */}
                <button
                  className="absolute top-12 left-4 w-10 h-10 rounded-2xl bg-white/10 border border-white/15 grid place-items-center font-black"
                  onClick={closePasscode}
                  aria-label="back"
                >
                  ‹
                </button>

                {/* 힌트 + 점 */}
                <div className="absolute top-45 left-0 right-0 grid place-items-center gap-3 scale-[1.1]">
                  <div className={["text-xs text-white/90 h-5 transition-all", hint ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"].join(" ")}>
                    힌트: 夜
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

                {/* 키패드 버튼 */}
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

                    {/* 긴급 버튼 */}
                    <button
                      className="h-14 rounded-full bg-white/10 border border-white/15 text-white text-xs font-extrabold active:scale-[.98]" style={{color: "rgb(248, 41, 41)"}}
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
                      className="h-14 rounded-full bg-white/10 border border-white/15 text-white text-base active:scale-[.98]"
                      onClick={deleteDigit}
                      aria-label="delete"
                    >
                      ⌫
                    </button>
                  </div>
                </div>

                {/* 긴급 연락처 */}
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

            {/* 앱 팝업 */}
            <AppModal
              open={appOpen && !!appId}
              title={appTitle}
              onBack={closeAppByBack}
              onAfterClose={clearAppId}
              // ✅ 갤러리는 자체 헤더(우측 X) 사용
              hideHeader={appId === "gallery"}
              onOverlayPointerDown={soundOnce}
            >
              {renderApp()}
            </AppModal>

            <style>{`
              .customCursor * { cursor: inherit !important; }
            `}</style>
          </div>
        </div>
      </div>
    </div>
  );
}
