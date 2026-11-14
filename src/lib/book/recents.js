// Recent books: names, page numbers and timestamps only. Covers live in the images store under coverKey(key).
import { MAX_RECENTS } from "../recents.js";

export const BOOK_RECENTS_KEY = "mimitori:books";
export const coverKey = (key) => `book:${key}`;

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function cleanBookRecents(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r.key === "string" && typeof r.name === "string")
    .map((r) => ({ key: r.key, name: r.name, page: num(r.page), pageCount: num(r.pageCount), coverage: num(r.coverage), watchedAt: num(r.watchedAt) ?? 0 }))
    .sort((a, b) => b.watchedAt - a.watchedAt)
    .slice(0, MAX_RECENTS);
}

export function loadBookRecents(storage = globalThis.localStorage) {
  try {
    return cleanBookRecents(JSON.parse(storage.getItem(BOOK_RECENTS_KEY)));
  } catch {
    return [];
  }
}

export function saveBookRecents(list, storage = globalThis.localStorage) {
  try {
    storage.setItem(BOOK_RECENTS_KEY, JSON.stringify(list));
  } catch {
    /* the list just won't survive a reload */
  }
}
