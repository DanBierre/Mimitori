// loadFile.js
// A dropped subtitle File -> parsed cues. Browser-only (uses File.arrayBuffer).

import { decodeSubtitleBytes } from "./decode.js";
import { parseSubtitles } from "./parse.js";

export async function readSubtitleFile(file) {
  const text = decodeSubtitleBytes(await file.arrayBuffer());
  const { cues, skipped } = parseSubtitles(text, file.name);
  return { name: file.name, cues, skipped };
}

const VIDEO_EXT = /\.(mp4|m4v|webm|mkv|mov|ogv)$/i;
const SUB_EXT = /\.(srt|vtt|ass|ssa)$/i;

export const isVideoFile = (file) => file.type.startsWith("video/") || VIDEO_EXT.test(file.name);
export const isSubtitleFile = (file) => SUB_EXT.test(file.name);
