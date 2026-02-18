export type SettingRow = { key: string; value: string };

export const SETTINGS: SettingRow[] = [
  { key: "이름", value: "九条 一輝" },
  { key: "뜻", value: "하나의 빛" },
  { key: "나이", value: "19세" },
  { key: "생년월일", value: "5월 20일" },
  { key: "신장", value: "170cm" },
  { key: "성격", value: "#가벼운 #장난기多 #잘웃는" },
  { key: "Like", value: "장난치기, 단 음식, 가족, 미즈키" },
  { key: "Hate", value: "지루한 것, 내 것에 해가 되는 것" },
  { key: "가족", value: "부모님, 쿠죠 사키(여동생)" },
  { key: "소지품", value: "지갑, 패션 안경, 휴대폰" },
  { key: "특징", value: "똑똑한 도련님 (요리 못함)" },
  { key: "♥️", value: "2026년 2월 3일" }
];

export function SettingsApp({ rows }: { rows: SettingRow[] }) {
  return (
    <div className="bg-[#f1f2f5] h-full">
      <div className="h-12 bg-white" />
      <div className="bg-white">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex items-center justify-between px-4 py-3 border-t border-black/5 text-sm"
          >
            <div className="text-black/80">{r.key}</div>
            <div className="text-black/45">{r.value}</div>
          </div>
        ))}
      </div>
      <div className="text-center text-xs text-black/25 py-6">2026.02.18</div>
    </div>
  );
}
