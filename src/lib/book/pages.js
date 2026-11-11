const IMAGE = /\.(jpe?g|png|webp|avif|gif)$/i;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function isImageName(path) {
  if (path.split("/").some((seg) => seg.startsWith(".") || seg === "__MACOSX")) return false;
  return IMAGE.test(path);
}

export function pickPages(items, pathOf) {
  return items
    .filter((t) => isImageName(pathOf(t)))
    .sort((a, b) => collator.compare(pathOf(a), pathOf(b)));
}
