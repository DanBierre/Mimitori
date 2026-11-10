// exportCsv.js
// Exports saved words as a CSV that Anki's importer reads directly
// (File > Import, fields: Front, Back, Sentence). Works on every platform,
// which is why it replaces the per-platform Anki hooks as the default exit.

function cell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function wordsToCsv(words) {
  const rows = words.map((w) =>
    [
      w.base,
      w.reading || "",
      (w.glosses || []).join("; "),
      w.sentence || "",
    ]
      .map(cell)
      .join(",")
  );
  return rows.join("\n");
}

export function downloadCsv(words) {
  const blob = new Blob(["﻿" + wordsToCsv(words)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mimitori-words.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
