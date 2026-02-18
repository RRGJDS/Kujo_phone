import { useEffect, useState } from "react";

type Item = { name: string; tag: "1순위" | "2순위" | "3순위" };
type Group = { group: string; items: Item[] };

const DATA: Group[] = [
  {
    group: "가족",
    items: [
      { name: "아버지", tag: "1순위" },
      { name: "어머니", tag: "1순위" },
      { name: "동생", tag: "2순위" }
    ]
  },
  {
    group: "지인",
    items: [
      { name: "요루 미즈키", tag: "2순위" },
      { name: "집사장", tag: "3순위" },
      { name: "기사님", tag: "3순위" }
    ]
  }
];

function tagColor(tag: Item["tag"]) {
  switch (tag) {
    case "1순위":
      return "text-red-600";
    case "2순위":
      return "text-orange-600";
    case "3순위":
      return "text-amber-600";
    default:
      return "text-slate-600";
  }
}

export function EmergencyModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const DURATION = 260;

  // mounted: DOM을 띄울지 여부 (닫힐 때 애니메이션 끝나고 제거)
  const [mounted, setMounted] = useState(open);

  // visible: 애니메이션 상태 (true면 올라온 상태, false면 내려간 상태)
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let t: number | undefined;
    let raf1: number | undefined;
    let raf2: number | undefined;

    if (open) {
      // 1) 먼저 DOM을 올리고
      setMounted(true);

      // 2) "시작 상태"를 강제로 만든 뒤(숨김/아래)
      setVisible(false);

      // 3) 두 번 rAF: 첫 렌더/페인트가 한 번 일어난 뒤에 visible=true로 전환
      //    (이렇게 해야 열릴 때 트랜지션이 100% 보장됨)
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else {
      // 닫기: 내려가는 애니메이션
      setVisible(false);

      // 애니메이션 끝나면 DOM 제거
      t = window.setTimeout(() => setMounted(false), DURATION);
    }

    return () => {
      if (t) window.clearTimeout(t);
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [open]);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 z-40">
      {/* 배경(오버레이): 페이드 */}
      <div
        className={[
          "absolute inset-0 bg-black/40 backdrop-blur-md",
          "transition-opacity duration-250 ease-out",
          visible ? "opacity-100" : "opacity-0"
        ].join(" ")}
        onClick={onClose}
      />

      {/* 중앙 모달: 아래→위 등장 / 위→아래 퇴장 */}
      <div className="absolute inset-0 grid place-items-center p-5">
        <div
          className={[
            "w-[88%] max-h-[82%] rounded-2xl",
            "border border-white/15 bg-zinc-50/70 shadow-2xl overflow-hidden",
            "transition-all duration-250 ease-out",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          ].join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="text-red-600 font-extrabold">긴급 연락처</div>
            <button
              className="w-8 h-8 rounded-xl border border-white/15 bg-white/5 font-black"
              onClick={onClose}
              aria-label="close"
            >
              ×
            </button>
          </div>

          <div className="p-3 overflow-auto max-h-[calc(82vh-52px)]">
            {DATA.map((g) => (
              <div key={g.group} className="mb-4">
                <div className="text-xs opacity-90 font-semibold mb-2">{g.group}</div>

                <div className="space-y-2">
                  {g.items.map((it, idx) => (
                    <div
                      key={it.name + idx}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs"
                    >
                      <div className="truncate">{it.name}</div>
                      <span
                        className={[
                          "px-2 py-1 rounded-lg border border-white/15 font-extrabold",
                          tagColor(it.tag)
                        ].join(" ")}
                      >
                        {it.tag}
                      </span>
                    </div>
                  ))}
                </div>

              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
