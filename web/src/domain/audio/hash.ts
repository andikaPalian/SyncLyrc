export async function computeSha256Hex(parts: (ArrayBuffer | string)[]): Promise<string> {
  const encoder = new TextEncoder();
  const buffers = parts.map((p) =>
    typeof p === "string" ? encoder.encode(p).buffer : p
  );
  const totalLen = buffers.reduce((acc, b) => acc + b.byteLength, 0);
  const combined = new Uint8Array(totalLen);

  let offset = 0;
  for (const buf of buffers) {
    combined.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  const digest = await crypto.subtle.digest("SHA-256", combined);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
