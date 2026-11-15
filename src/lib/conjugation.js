// conjugation.js
// Plain-English labels for the endings kuromoji splits off a verb or adjective:
// 食べ + なかっ + た -> ["not", "past"], shown on the word card as
// "食べる · not · past".

const LABELS = {
  ない: "not",
  ぬ: "not",
  ん: "not",
  た: "past",
  だ: "past",
  ます: "polite",
  です: "polite",
  たい: "want to",
  れる: "passive / can",
  られる: "passive / can",
  せる: "make / let",
  させる: "make / let",
  う: "let's / will",
  よう: "let's / will",
  て: "-te form",
  で: "-te form",
  いる: "-ing / state",
  てる: "-ing / state",
  でる: "-ing / state",
  しまう: "completely / oops",
  ちゃう: "completely / oops",
  じゃう: "completely / oops",
  ちまう: "completely / oops",
  みる: "try",
  おく: "in advance",
  くださる: "please",
  ば: "if",
  ながら: "while",
  そう: "looks like",
};

// Labels that depend on the written form: 食べたら is た written たら.
const BY_SURFACE = { たら: "if / when", だら: "if / when" };

const CONNECTORS = new Set(["て", "で", "ば", "ながら"]);

function isEnding(token) {
  if (token.pos === "助動詞") return true;
  if (token.pos === "助詞") return token.posDetail === "接続助詞" && CONNECTORS.has(token.base);
  if (token.pos === "名詞") return token.posDetail === "接尾" && token.base === "そう"; // 寒そう
  // いる/しまう after て are 非自立; られる/させる are suffixes (接尾).
  return token.pos === "動詞" && (token.posDetail === "非自立" || token.posDetail === "接尾");
}

export function conjugationParts(tokens, index) {
  const head = tokens[index];
  if (!head || (head.pos !== "動詞" && head.pos !== "形容詞")) return [];
  const parts = [];
  for (let i = index + 1; i < tokens.length; i++) {
    const tok = tokens[i];
    // 食べても: て followed by も reads as one ending, "even if".
    if (tok.pos === "助詞" && tok.base === "も" && parts[parts.length - 1] === "-te form") {
      parts[parts.length - 1] = "even if";
      break;
    }
    if (!isEnding(tok)) break;
    const label = BY_SURFACE[tok.surface] || LABELS[tok.base];
    if (label && parts[parts.length - 1] !== label) parts.push(label);
  }
  return parts;
}
