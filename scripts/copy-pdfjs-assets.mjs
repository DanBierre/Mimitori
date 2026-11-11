// Copies pdf.js's cmaps, standard fonts and wasm into public/pdfjs/ (git-ignored) so the app serves them itself.
// pdf.js only fetches these when a PDF needs them. Skips when the copy already matches the installed version.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(root, "node_modules", "pdfjs-dist");
const to = path.join(root, "public", "pdfjs");
const version = JSON.parse(fs.readFileSync(path.join(from, "package.json"), "utf8")).version;
const stamp = path.join(to, ".version");

if (fs.existsSync(stamp) && fs.readFileSync(stamp, "utf8") === version) {
  console.log(`pdfjs assets ${version}: up to date`);
} else {
  fs.rmSync(to, { recursive: true, force: true });
  for (const dir of ["cmaps", "standard_fonts", "wasm"]) fs.cpSync(path.join(from, dir), path.join(to, dir), { recursive: true });
  fs.writeFileSync(stamp, version);
  console.log(`pdfjs assets ${version}: copied to public/pdfjs`);
}
