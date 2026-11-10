// decode.js
// Subtitle file bytes -> text. Handles UTF-8, UTF-16 (with BOM) and the
// Shift-JIS that older Japanese .srt files still use.

export function decodeSubtitleBytes(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text;
  if (u8[0] === 0xff && u8[1] === 0xfe) text = new TextDecoder("utf-16le").decode(u8);
  else if (u8[0] === 0xfe && u8[1] === 0xff) text = new TextDecoder("utf-16be").decode(u8);
  else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(u8);
    } catch {
      text = new TextDecoder("shift_jis").decode(u8);
    }
  }
  return text.replace(/^\uFEFF/, "");
}
