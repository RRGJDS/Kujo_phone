// ✅ 정답을 코드에 그대로 쓰지 않기 위해 SHA-256 해시로 비교하는 유틸

const TARGET_SHA256_HEX =
  "e39eef82f61b21e2e7f762fcc4307358f165757f2e77ec855d6992f7e0191932"; // sha256("1024")

function toHex(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text: string) {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export async function verifyPin(pin4: string) {
  const hash = await sha256Hex(pin4);
  return hash === TARGET_SHA256_HEX;
}
