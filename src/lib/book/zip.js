// Minimal zip reader for CBZ files. Works through Blob.slice, so a 300 MB file is never read whole.
// No zip64; CBZ files over 4 GB are rare, add zip64 records if one turns up

const fail = (code, message) => Object.assign(new Error(message), { code });
const read = async (blob, start, end) => new Uint8Array(await blob.slice(start, end).arrayBuffer());
const view = (u8) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

function decodeName(bytes, flags) {
  if (flags & 0x800) return new TextDecoder("utf-8").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("shift_jis").decode(bytes);
  }
}

export async function listEntries(blob) {
  const tailStart = Math.max(0, blob.size - 65557);
  const tail = await read(blob, tailStart, blob.size);
  const tv = view(tail);
  let at = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tv.getUint32(i, true) === 0x06054b50) { at = i; break; }
  }
  if (at < 0) throw fail("not-zip", "No zip end record");
  const count = tv.getUint16(at + 10, true);
  const cdSize = tv.getUint32(at + 12, true);
  const cdOffset = tv.getUint32(at + 16, true);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw fail("zip64", "Zip64 not supported");

  const cd = await read(blob, cdOffset, cdOffset + cdSize);
  const v = view(cd);
  const entries = [];
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > cd.length || v.getUint32(p, true) !== 0x02014b50) throw fail("not-zip", "Bad central directory");
    const flags = v.getUint16(p + 8, true);
    const method = v.getUint16(p + 10, true);
    const compressedSize = v.getUint32(p + 20, true);
    const size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const localOffset = v.getUint32(p + 42, true);
    const name = decodeName(cd.subarray(p + 46, p + 46 + nameLen), flags);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    if (flags & 1) throw fail("encrypted", "Zip is encrypted");
    entries.push({ name, method, flags, compressedSize, size, localOffset });
  }
  return entries;
}

export async function readEntry(blob, entry) {
  if (entry.method !== 0 && entry.method !== 8) throw fail("bad-method", `Unsupported method ${entry.method}`);
  const head = await read(blob, entry.localOffset, entry.localOffset + 30);
  const hv = view(head);
  if (hv.getUint32(0, true) !== 0x04034b50) throw fail("not-zip", "Bad local header");
  const start = entry.localOffset + 30 + hv.getUint16(26, true) + hv.getUint16(28, true);
  const body = blob.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return new Uint8Array(await body.arrayBuffer());
  const stream = body.stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
