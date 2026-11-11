// Test-only helpers: build zips by hand. Not imported by the app.
import zlib from "node:zlib";

const enc = new TextEncoder();

// Shift_JIS encoder for tests: Node has no encoder, so build a reverse map by decoding.
let sjisMap;
export function sjisBytes(str) {
  if (!sjisMap) {
    sjisMap = new Map();
    const dec = new TextDecoder("shift_jis");
    for (let b = 0x20; b < 0x7f; b++) sjisMap.set(String.fromCharCode(b), [b]);
    for (let a = 0x81; a <= 0xfc; a++) {
      if (a >= 0xa0 && a <= 0xdf) continue;
      for (let b = 0x40; b <= 0xfc; b++) {
        const ch = dec.decode(new Uint8Array([a, b]));
        if (ch.length === 1 && ch !== "\ufffd" && !sjisMap.has(ch)) sjisMap.set(ch, [a, b]);
      }
    }
  }
  return Uint8Array.from([...str].flatMap((c) => sjisMap.get(c)));
}

function crc(data) {
  return zlib.crc32(data);
}

// Builds a zip by hand: local headers, central directory, end record.
export function makeZip(files, comment = "", flagsOverride = 0) {
  const parts = [];
  const central = [];
  let offset = 0;
  const u16 = (n) => [n & 255, (n >> 8) & 255];
  const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const f of files) {
    const nameBytes = f.nameBytes ?? enc.encode(f.name);
    const raw = f.data;
    const body = f.method === 8 ? zlib.deflateRawSync(raw) : raw;
    const flags = (f.utf8 ? 0x800 : 0) | flagsOverride;
    const local = Uint8Array.from([
      ...u32(0x04034b50), ...u16(20), ...u16(flags), ...u16(f.method), ...u16(0), ...u16(0),
      ...u32(crc(raw)), ...u32(body.length), ...u32(raw.length), ...u16(nameBytes.length), ...u16(0),
      ...nameBytes,
    ]);
    parts.push(local, body);
    central.push(Uint8Array.from([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(flags), ...u16(f.method), ...u16(0), ...u16(0),
      ...u32(crc(raw)), ...u32(body.length), ...u32(raw.length), ...u16(nameBytes.length),
      ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameBytes,
    ]));
    offset += local.length + body.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const cm = enc.encode(comment);
  const end = Uint8Array.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(cdSize), ...u32(offset), ...u16(cm.length), ...cm,
  ]);
  return Buffer.concat([...parts, ...central, end]);
}

