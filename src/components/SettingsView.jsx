import { useEffect, useRef, useState } from "react";
import { ankiMode, useStore, useT } from "../lib/store";
import { INKS, THEMES, inkById } from "../lib/ink";
import { anki, useAnki } from "../lib/anki/useAnki";
import { guessFieldRoles, ROLES } from "../lib/anki/fieldRoles";
import { listFailed, retryFailed } from "../lib/anki/queue";
import { deckQuery } from "../lib/anki/known";
import Icon from "./Icon";
import { backupCounts, downloadBackup, parseBackup, restoreBackup } from "../lib/backup";
import { ROLE_LABELS, buildMapping, flatFields, hasWordField, lowConfidence, pickSampleQuery, templateParts } from "../lib/anki/settingsLogic";

const STATUS_TEXT = {
  checking: "Checking Anki…",
  ok: "Connected to Anki.",
  unreachable: "Anki isn't reachable. Open Anki, then press Connect.",
  outdated: "Your Anki add-on is out of date. Update it in Anki (Tools, Add-ons), then press Connect.",
  forbidden: "Anki said no. Press Connect again and choose Yes in the box Anki shows.",
};

const ago = (when, t) => {
  if (!when) return t("never");
  const m = Math.round((Date.now() - when) / 60000);
  return m < 1 ? t("just now") : m < 60 ? t("{m} min ago", { m }) : new Date(when).toLocaleString();
};

// Deck notes are stored as English sentences with the deck baked in, so translate by pattern.
const deckNote = (n, t) => {
  let m = n.match(/^(.*) wasn't found in Anki$/);
  if (m) return t("{deck} wasn’t found in Anki", { deck: m[1] });
  m = n.match(/^Couldn't find the word field in (.*)$/);
  return m ? t("Couldn’t find the word field in {deck}", { deck: m[1] }) : n;
};

const plain = (v) => String(v || "").replace(/<[^>]*>/g, " ").replace(/\[sound:[^\]]*\]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);

function RoleSelect({ field, value, isTemplate, onChange }) {
  const t = useT();
  return (
    <select className="select" value={value} aria-label={t("Role for {field}", { field })} onChange={(e) => onChange(e.target.value)}>
      {isTemplate && <option value="template">{t("Layout (as detected)")}</option>}
      {ROLES.map((r) => (
        <option key={r} value={r}>{t(ROLE_LABELS[r])}</option>
      ))}
      <option value="none">{t("Leave empty")}</option>
    </select>
  );
}

export default function SettingsView({ active, onBack, backLabel = "Read" }) {
  const { state, setAnkiSettings, setSettings, setDeckNotes } = useStore();
  const t = useT();
  const cfg = state.settings.anki;
  const a = useAnki(active);
  // Anki is optional: before the learner presses Connect, "not reachable" is just "not set up", not an error.
  const [tried, setTried] = useState(false);
  const touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const quiet = !tried && a.status === "unreachable";

  // Esc goes back, unless you're typing in a field.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || !onBack) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return;
      onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);
  const [draft, setDraft] = useState(null); // { fieldNames, guesses, roles }
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [failed, setFailed] = useState([]);
  const [pending, setPending] = useState(null); // a parsed backup waiting for "Replace"
  const [backupError, setBackupError] = useState("");

  // Re-sync when the decks or tagging change (after the new settings have rendered).
  const syncKey = JSON.stringify([cfg.readDecks, cfg.tagKnown]);
  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    a.refreshKnown({ force: true });
  }, [syncKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFailed = () => listFailed().then(setFailed).catch(() => {});
  useEffect(() => {
    if (active) loadFailed();
  }, [active]);

  const pick = (patch) => {
    setDraft(null);
    setAnkiSettings({ ...patch, mapping: {}, fieldList: [], enabled: false });
  };

  async function checkFields() {
    setChecking(true);
    setCheckError("");
    try {
      const fieldNames = await anki.invoke("modelFieldNames", { modelName: cfg.model });
      const inDeck = await anki.invoke("findNotes", { query: `${deckQuery(cfg.deck)} "note:${cfg.model}"` });
      const { query, scope } = pickSampleQuery({ deckCount: inDeck.length, deck: cfg.deck, model: cfg.model });
      const ids = scope === "deck" ? inDeck : await anki.invoke("findNotes", { query });
      const infos = ids.length ? await anki.invoke("notesInfo", { notes: ids.slice(-20) }) : [];
      const guesses = guessFieldRoles(fieldNames, infos.map(flatFields));
      const roles = Object.fromEntries(fieldNames.map((f) => [f, guesses[f].role || "none"]));
      const n = infos.length;
      const source = n === 0 ? "" : scope === "deck" ? t("Learned from {n} cards in {deck}.", { n, deck: cfg.deck }) : t("Learned from your {n} most recent {model} cards.", { n, model: cfg.model });
      setDraft({ fieldNames, guesses, roles, source });
    } catch (e) {
      setCheckError(e.message);
    } finally {
      setChecking(false);
    }
  }

  function looksRight() {
    const mapping = buildMapping(draft.fieldNames, draft.guesses, draft.roles);
    if (!hasWordField(mapping)) {
      setCheckError(t("Pick which field holds the word (or the layout) first."));
      return;
    }
    setCheckError("");
    setAnkiSettings({ mapping, fieldList: draft.fieldNames });
    setDraft(null);
  }

  async function pickBackup(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setPending(null);
    try {
      setPending(parseBackup(await file.text()));
      setBackupError("");
    } catch (err) {
      setBackupError(t(err.message));
    }
  }

  const ready = Boolean(cfg.deck && cfg.model && Object.keys(cfg.mapping).length);
  const connected = a.status === "ok";

  return (
    <section className="settings">
      <div className="settings__top">
        {onBack && (
          <button className="btn btn--quiet settings__back" onClick={onBack}>
            <Icon name="prev" size={18} />
            {t("Back to {tab}", { tab: backLabel })}
          </button>
        )}
        <h2 className="settings__title">{t("Settings")}</h2>
      </div>

      <div className="settings__section">
        <h3 className="settings__heading">{t("Make it yours")}</h3>
        <div className="settings__row" role="radiogroup" aria-labelledby="ink-label">
          <span id="ink-label" className="settings__label">{t("Your ink")}</span>
          <div className="inks__dots">
            {INKS.map((ink) => (
              <label key={ink.id} className="inks__dot" style={{ "--swatch-l": ink.light, "--swatch-d": ink.dark }}>
                <input
                  type="radio"
                  name="ink"
                  value={ink.id}
                  aria-label={t(ink.name)}
                  checked={inkById(state.settings.ink).id === ink.id}
                  onChange={() => setSettings({ ink: ink.id })}
                />
                <span className="inks__swatch" aria-hidden="true" />
                <span className="inks__name" aria-hidden="true">{t(ink.name)}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="settings__row" role="radiogroup" aria-labelledby="theme-label">
          <span id="theme-label" className="settings__label">{t("Theme")}</span>
          <div className="inks__dots">
            {THEMES.map((th) => (
              <label key={th.id} className="inks__dot">
                <input
                  type="radio"
                  name="theme"
                  value={th.id}
                  aria-label={t(th.name)}
                  checked={(state.settings.theme || "light") === th.id}
                  onChange={() => setSettings({ theme: th.id })}
                />
                <span className="inks__name" aria-hidden="true">{t(th.name)}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="settings__row" role="radiogroup" aria-labelledby="lang-label">
          <span id="lang-label" className="settings__label">{t("Interface language")}</span>
          <div className="inks__dots">
            {[["en", "English"], ["ja", "日本語"]].map(([id, name]) => (
              <label key={id} className="inks__dot">
                <input
                  type="radio"
                  name="lang"
                  value={id}
                  aria-label={name}
                  checked={(state.settings.lang || "en") === id}
                  onChange={() => setSettings({ lang: id })}
                />
                <span className="inks__name" aria-hidden="true">{name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="settings__row">
          <label className="settings__label" htmlFor="your-name">{t("Your name (optional)")}</label>
          <input
            id="your-name"
            className="text-input"
            type="text"
            maxLength={40}
            autoComplete="given-name"
            value={state.settings.name || ""}
            onChange={(e) => setSettings({ name: e.target.value })}
          />
        </div>
        <label className="settings__toggle">
          <input type="checkbox" checked={state.settings.ambient !== false} onChange={(e) => setSettings({ ambient: e.target.checked })} />
          <span>{t("Soft light from the video")}</span>
        </label>
        <p className="note">{t("Your ink colours saved words and progress. Your name only appears in the greeting on Watch.")}</p>
      </div>

      <div className="settings__section">
        <h3 className="settings__heading">Anki</h3>
        <p className={`note ${a.status === "ok" || quiet ? "" : "note--error"}`} role="status">
          {quiet ? t("Optional. Mimitori can send cards straight to your Anki deck on a computer.") : t(STATUS_TEXT[a.status])}
        </p>
        {a.error && <p className="note note--error">{t(a.error)}</p>}
        {!connected && a.status !== "checking" && touch && (
          <p className="note">{t("Anki sync works on a computer. On your phone, export your words as a CSV from the Words tab.")}</p>
        )}
        {!connected && a.status !== "checking" && !touch && (
          <>
            <ol className="settings__steps">
              <li>{t("Open Anki on this computer.")}</li>
              <li><a href="/mimitori.ankiaddon" download>{t("Download the Mimitori add-on")}</a></li>
              <li>{t("Double-click the downloaded file to install it, then restart Anki.")}</li>
              <li>{t("Press Connect.")}</li>
            </ol>
            <p className="note">{t("Already set up AnkiConnect? That still works.")}</p>
            <button
              className="btn btn--primary"
              onClick={() => {
                setTried(true);
                a.connect();
              }}
            >
              {t("Connect")}
            </button>
          </>
        )}

        {connected && (
          <>
            <div className="settings__row">
              <label className="settings__label" htmlFor="anki-deck">{t("Deck")}</label>
              <select id="anki-deck" className="select" value={cfg.deck} onChange={(e) => pick({ deck: e.target.value })}>
                <option value="">{t("Choose a deck…")}</option>
                {a.decks.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="settings__row">
              <label className="settings__label" htmlFor="anki-model">{t("Note type")}</label>
              <select id="anki-model" className="select" value={cfg.model} onChange={(e) => pick({ model: e.target.value })}>
                <option value="">{t("Choose a note type…")}</option>
                {a.models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <p className="note settings__hint">{t("The note type is the card layout in Anki, like “Basic” or your Japanese template.")}</p>
            <div className="settings__row">
              <button className="btn" disabled={!cfg.deck || !cfg.model || checking} onClick={checkFields}>
                {checking ? t("Checking…") : t("Check fields")}
              </button>
              {ready && !draft && <span className="note settings__inline">{t("{n} fields matched.", { n: Object.keys(cfg.mapping).length })}</span>}
            </div>
            {checkError && <p className="note note--error">{t(checkError)}</p>}
          </>
        )}

        {draft && (
          <div className="settings__table-wrap">
            <p className="note">{draft.source || t("You have no cards of this type yet, so these are guesses from the field names.")}</p>
            <table className="settings__table">
              <thead>
                <tr><th>{t("Field")}</th><th>{t("Role")}</th><th>{t("Example")}</th></tr>
              </thead>
              <tbody>
                {draft.fieldNames.map((f) => {
                  const g = draft.guesses[f];
                  const isTemplate = g.role === "template";
                  const role = draft.roles[f];
                  return (
                    <tr key={f}>
                      <td>
                        {f}
                        {(lowConfidence(g) || !g.role) && role === g.role && <span className="settings__flag">{t("Check this")}</span>}
                      </td>
                      <td>
                        <RoleSelect field={f} value={role} isTemplate={isTemplate} onChange={(v) => setDraft({ ...draft, roles: { ...draft.roles, [f]: v } })} />
                        {isTemplate && role === "template" && (
                          <div className="settings__layout" lang="ja">
                            {templateParts(g.template).map((p, i) =>
                              p.slot ? <span key={i} className="settings__chip">{p.slot}</span> : <span key={i}>{p.text}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="settings__sample" lang="ja">{g.sample}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="settings__row">
              <button className="btn btn--primary" onClick={looksRight}>{t("Looks right")}</button>
              <button className="btn btn--quiet" onClick={() => setDraft(null)}>{t("Cancel")}</button>
            </div>
          </div>
        )}
      </div>

      <div className="settings__section">
        <h3 className="settings__heading">{t("Saving and known words")}</h3>
        <label className="settings__toggle">
          <input
            type="checkbox"
            checked={ankiMode(state)}
            disabled={!ready}
            onChange={(e) => setAnkiSettings({ enabled: e.target.checked })}
          />
          <span>{t("Send saves to Anki")}</span>
        </label>
        {!ready && <p className="note">{t("Pick a deck and note type, then check the fields, to turn this on.")}</p>}
        {ready && (
          <p className="note">
            {t("Saved words go to Anki instead of the Review tab. If Anki is closed, they wait here and go across later.")}
          </p>
        )}

        <div className="settings__row">
          <button className="btn" disabled={!ready || !connected || a.syncing} onClick={() => a.refreshKnown({ force: true })}>
            {a.syncing ? t("Syncing…") : t("Sync known words")}
          </button>
          <span className="note settings__inline">
            {t("{known} known, {inDeck} in Anki. Last synced {when}.", { known: Object.keys(state.anki.known).length, inDeck: Object.keys(state.anki.inDeck).length, when: ago(state.anki.syncedAt, t) })}
          </span>
        </div>
        {a.progress && (
          <p className="note" role="status">{t("Reading {deck}… {done} of {total}", { deck: a.progress.deck, done: a.progress.done, total: a.progress.total })}</p>
        )}
        {(state.anki.deckNotes || []).map((n) => <p key={n} className="note">{deckNote(n, t)}</p>)}

        {ready && connected && (
          <>
            <p className="settings__label">{t("Decks to read")}</p>
            {a.decks.map((d) => {
              const isAddTo = d === cfg.deck;
              const on = isAddTo || cfg.readDecks.includes(d);
              return (
                <label key={d} className="settings__toggle">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={isAddTo || a.syncing}
                    onChange={(e) => {
                      const rest = cfg.readDecks.filter((x) => x !== d && x !== cfg.deck);
                      setDeckNotes([]);
                      setAnkiSettings({ readDecks: e.target.checked ? [...rest, d] : rest });
                    }}
                  />
                  <span>{d}</span>
                </label>
              );
            })}
            <label className="settings__toggle">
              <input type="checkbox" checked={cfg.tagKnown} disabled={a.syncing} onChange={(e) => setAnkiSettings({ tagKnown: e.target.checked })} />
              <span>{t("Tag words I know in Anki")}</span>
            </label>
            <p className="note">
              {t("Adds a mimitori-known tag to cards in {deck} for words you’ve marked known here. Only that deck, nothing else is changed.", { deck: cfg.deck })}
            </p>
          </>
        )}

        <label className="settings__toggle">
          <input
            type="checkbox"
            checked={state.settings.commonKnown !== false}
            onChange={(e) => setSettings({ commonKnown: e.target.checked })}
          />
          <span>{t("Treat very common words as known")}</span>
        </label>
        <p className="note">{t("About 2,000 everyday words like 何, する and いる. They won’t get furigana or be suggested for Anki.")}</p>

        {(ankiMode(state) || a.queueCount > 0) && (
          <p className="note">
            {a.queueCount === 0
              ? t("Nothing waiting for Anki.")
              : t(a.queueCount === 1 ? "{n} card is waiting for Anki. They go in when Anki's open." : "{n} cards are waiting for Anki. They go in when Anki's open.", { n: a.queueCount })}
          </p>
        )}

        {failed.length > 0 && (
          <>
            <p className="note note--error">{t("{n} couldn’t be sent:", { n: failed.length })}</p>
            <ul className="settings__failed">
              {failed.map((f) => (
                <li key={f.id}>
                  <span lang="ja">{plain(Object.values(f.note.fields || {})[0])}</span>
                  <span className="note settings__inline">{t(f.lastError)}</span>
                  <button className="btn btn--quiet" onClick={() => retryFailed(f.id).then(() => { loadFailed(); a.refreshQueue(); })}>
                    {t("Retry")}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="settings__section">
        <h3 className="settings__heading">{t("Backup")}</h3>
        <p className="note">
          {t("Your words live on this device only. Save a backup now and then, and keep it somewhere safe. It holds your saved words, review history, known words and settings.")}
        </p>
        <div className="settings__row">
          <button className="btn" onClick={() => downloadBackup(state)}>{t("Save a backup")}</button>
          <label className="btn btn--quiet">
            {t("Restore from a backup")}
            <input type="file" accept=".json,application/json" className="sr-only" onChange={pickBackup} />
          </label>
        </div>
        {backupError && <p className="note note--error">{t(backupError)}</p>}
        {pending && (
          <div role="alert">
            <p className="note">
              {t("This replaces everything here ({a} saved, {b} known) with the backup ({c} saved, {d} known). Save a backup first if you’re not sure.", { a: backupCounts(state).saved, b: backupCounts(state).known, c: backupCounts(pending).saved, d: backupCounts(pending).known })}
            </p>
            <div className="settings__row">
              <button className="btn btn--primary" onClick={() => { restoreBackup(pending); location.reload(); }}>{t("Replace")}</button>
              <button className="btn btn--quiet" onClick={() => setPending(null)}>{t("Cancel")}</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
