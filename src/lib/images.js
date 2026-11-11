// images.js
// Scene stills for words saved in Watch. Kept in IndexedDB, not localStorage:
// localStorage holds ~5 MB, which a couple of hundred JPEGs would fill and
// then silently stop saving words. A still is a nice extra, so failures here
// never block saving the word itself.

const DB_NAME = "nihongo-reader-images";
const STORE = "images";

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function run(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const putImage = (base, blob) => run("readwrite", (s) => s.put(blob, base)).catch(() => {});
export const deleteImage = (base) => run("readwrite", (s) => s.delete(base)).catch(() => {});

export async function getImageUrl(base) {
  try {
    const blob = await run("readonly", (s) => s.get(base));
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

// Current video frame as a JPEG (480px wide unless told otherwise), or null.
export function captureFrame(video, width = 480, quality = 0.7) {
  return new Promise((resolve) => {
    try {
      if (!video?.videoWidth) return resolve(null);
      const height = Math.round((width * video.videoHeight) / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(video, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    } catch {
      resolve(null);
    }
  });
}
