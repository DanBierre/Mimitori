import { useState } from "react";
import { tokenizeWithReadings, JAPANESE_REGEX } from "../lib/furigana";
import { translateText, translationEnabled } from "../lib/translate";
import { useStore } from "../lib/store";
import TokenLine from "./TokenLine";
import { useMarker } from "../lib/useMarker";
import { conjugationParts } from "../lib/conjugation";
import { canSpeak, speak } from "../lib/speak";
import WordPanel from "./WordPanel";
import { sentenceAround, sentenceSpan } from "../lib/sentence";

const SAMPLE =
  "今日は友達と一緒に日本語を勉強します。難しい漢字がたくさんありますが、毎日少しずつ読むと、だんだん分かるようになります。";

const FURIGANA_MODES = [
  ["unknown", "New words"],
  ["all", "All"],
  ["off", "Off"],
];

function ankiContext(tokens, i) {
  const { start, end } = sentenceSpan(tokens, i);
  return { sentence: sentenceAround(tokens, i), tokens: tokens.slice(start, end + 1), tokenIndex: i - start };
}

export default function ReadView({ onOpenSettings }) {
  const { state, setSettings } = useStore();
  const { furigana, size } = state.settings;
  const furiRef = useMarker('[aria-pressed="true"]');

  const [input, setInput] = useState("");
  const [tokens, setTokens] = useState(null);
  const [translation, setTranslation] = useState({ status: "idle", text: "", error: "" });
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null); // token index

  async function handleLookup() {
    const text = input.trim();
    if (!text) return;
    if (!JAPANESE_REGEX.test(text)) {
      setError("That doesn’t look like Japanese. Paste some Japanese text and try again.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError("");
    setSelected(null);
    setTokens(null);
    if (translationEnabled) {
      setTranslation({ status: "loading", text: "", error: "" });
      translateText(text)
        .then((t) => setTranslation({ status: "ready", text: t, error: "" }))
        .catch((e) => setTranslation({ status: "error", text: "", error: e.message }));
    }

    try {
      setTokens(await tokenizeWithReadings(text));
      setStatus("idle");
    } catch {
      setError("The reading engine didn’t load. Reload the page and try again.");
      setStatus("error");
    }
  }

  function backToEdit() {
    setTokens(null);
    setSelected(null);
  }

  const selectedToken = tokens && selected !== null ? tokens[selected] : null;
  const panelOpen = Boolean(selectedToken);

  return (
    <div className={`read ${panelOpen ? "read--panel-open" : ""}`}>
      <section className="sheet read__sheet" aria-label="Reading sheet">
        {!tokens ? (
          <div className="read__compose">
            <label className="sheet__label" htmlFor="paste">
              Paste Japanese
            </label>
            <textarea
              id="paste"
              className="read__input"
              lang="ja"
              placeholder="ここに日本語を貼り付けてください"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={7}
            />
            <div className="read__compose-actions">
              <button
                className="btn btn--primary"
                onClick={handleLookup}
                disabled={status === "loading" || !input.trim()}
              >
                {status === "loading" ? "Reading…" : "Read this"}
              </button>
              <button className="btn btn--quiet" onClick={() => setInput(SAMPLE)}>
                Use a sample
              </button>
            </div>
            {status === "error" && (
              <p className="note note--error" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="read__toolbar">
              <div className="segmented" role="group" aria-label="Furigana" ref={furiRef}>
                <span className="marker" aria-hidden="true" />
                <span className="segmented__label">Furigana</span>
                {FURIGANA_MODES.map(([value, label]) => (
                  <button
                    key={value}
                    className="segmented__btn"
                    aria-pressed={furigana === value}
                    onClick={() => setSettings({ furigana: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="stepper" role="group" aria-label="Text size">
                <button
                  className="stepper__btn"
                  onClick={() => setSettings({ size: Math.max(18, size - 2) })}
                  aria-label="Smaller text"
                >
                  A−
                </button>
                <button
                  className="stepper__btn stepper__btn--big"
                  onClick={() => setSettings({ size: Math.min(44, size + 2) })}
                  aria-label="Larger text"
                >
                  A+
                </button>
              </div>
            </div>

            <p className="read__text" lang="ja" style={{ "--read-size": `${size}px` }}>
              <TokenLine tokens={tokens} selected={selected} onSelect={setSelected} />
            </p>

            {translationEnabled && (
            <div className="read__translation">
              {translation.status === "loading" && <p className="note">Translating…</p>}
              {translation.status === "ready" && <p className="read__translation-text">{translation.text}</p>}
              {translation.status === "error" && (
                <p className="note">Translation isn’t available right now. Readings and word lookup still work.</p>
              )}
            </div>
            )}

            <div className="read__after">
              <button className="btn btn--quiet read__edit" onClick={backToEdit}>
                Edit text
              </button>
              {canSpeak() && (
                <button className="btn btn--quiet read__edit" onClick={() => speak(input)}>
                  Say it
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {selectedToken && (
        <WordPanel
          token={selectedToken}
          sentence={sentenceAround(tokens, selected)}
          grammar={conjugationParts(tokens, selected)}
          ankiContext={ankiContext(tokens, selected)}
          onOpenSettings={onOpenSettings}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
