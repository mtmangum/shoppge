// Verifies file content against its claimed MIME type using magic bytes,
// since a client-supplied Content-Type/File.type is trivially spoofable and
// must never be trusted for a security-relevant decision on its own.

const SIGNATURES: { type: string; bytes: number[] }[] = [
  { type: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
]

export function sniffFileType(buffer: Buffer): string | null {
  for (const { type, bytes } of SIGNATURES) {
    if (buffer.length >= bytes.length && bytes.every((byte, i) => buffer[i] === byte)) {
      return type
    }
  }
  return null
}
