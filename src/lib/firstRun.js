// First-run helpers: one-time flags (welcome tips, first visit) and the built-in sample clip.

const PREFIX = "mimitori:";

// localStorage can throw (private mode, blocked storage); a flag we can't read just counts as unset.
export function createFlags(storage = globalThis.localStorage) {
  return {
    has(name) {
      try {
        return storage.getItem(PREFIX + name) === "1";
      } catch {
        return false;
      }
    },
    set(name) {
      try {
        storage.setItem(PREFIX + name, "1");
      } catch {
        /* nothing to do: it'll just show again next time */
      }
    },
  };
}

// Files live in public/sample/. Swap the files (and the credit) to change the sample.
export const SAMPLE = {
  files: [
    ["sample.mp4", "video/mp4"],
    ["sample-ja.srt", "text/plain"],
    ["sample-en.srt", "text/plain"],
  ],
  credit: "Sample clip made for Mimitori: colour scenes and a quiet chord, no speech. Read along with the subtitles.",
};

// Fetches the sample as File objects, so Watch loads it exactly like files the learner picked.
export async function sampleFiles(fetchImpl = fetch, base = "/sample/") {
  return Promise.all(
    SAMPLE.files.map(async ([name, type]) => {
      const res = await fetchImpl(base + name);
      if (!res.ok) throw new Error(`Couldn't load ${name} (${res.status})`);
      return new File([await res.blob()], name, { type });
    }),
  );
}
