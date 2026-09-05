/** Inspect the ZIP directory before Mammoth expands DOCX parts. */
export function checkDocxBudget(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0)
    throw new Error(
      "Malformed DOCX archive. Choose another file or paste text.",
    );
  const count = b.readUInt16LE(end + 10);
  let offset = b.readUInt32LE(end + 16),
    total = 0;
  if (count > 2048) throw new Error("DOCX contains too many archive entries.");
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || b.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("Malformed DOCX directory.");
    if (b.readUInt16LE(offset + 8) & 1)
      throw new Error(
        "Encrypted DOCX: provide an unlocked copy or paste text.",
      );
    total += b.readUInt32LE(offset + 24);
    if (total > 32 * 1024 * 1024)
      throw new Error(
        "DOCX expanded content exceeds the 32 MiB extraction budget. Paste text instead.",
      );
    offset +=
      46 +
      b.readUInt16LE(offset + 28) +
      b.readUInt16LE(offset + 30) +
      b.readUInt16LE(offset + 32);
  }
  if (offset > end) throw new Error("Malformed DOCX directory.");
}
