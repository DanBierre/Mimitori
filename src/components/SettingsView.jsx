import { useEffect, useState } from "react";
import { ankiMode, useStore } from "../lib/store";
import { anki, useAnki } from "../lib/anki/useAnki";
import { guessFieldRoles, ROLES } from "../lib/anki/fieldRoles";
import { listFailed, retryFailed } from "../lib/anki/queue";
import { ROLE_LABELS, buildMapping, flatFields, lowConfidence, templateParts } from "../lib/anki/settingsLogic";

const STATUS_TEXT = {
  checking: "Checking Anki…",
  ok: "Connected to Anki.",
  unreachable: "Anki isn't reachable. Open Anki, then press Connect.",
  outdated: "Your AnkiConnect add-on is out of date. Update it in Anki (Tools, Add-ons), then press Connect.",
  forbidden: "Anki said no. Press Connect again and choose Yes in the box Anki shows.",
};

const ago = (t) => {
  if (!t) return "never";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : new Date(t).toLocaleString();
};

const plain = (v) => String(v || "").replace(/<[^>]*>/g, " ").replace(/\[sound:[^\]]*\]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);

function RoleSelect({ field, value, isTemplate, onChange }) {
  return (
    <select className="select" value={value} aria-label={`Role for ${field}`} onChange={(e) => onChange(e.target.value)}>
      {isTemplate && <option value="template">Layout (as detected)</option>}
      {ROLES.map((r) => (
        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
      ))}
      <option value="none">Leave empty</option>
    </select>
  );
}

export default function SettingsView({ active }) {
  const { state, setAnkiSettings } = useStore();
  const cfg = state.settings.anki;
  const a = useAnki(active);
  const [draft, setDraft] = useState(null); // { fieldNames, guesses, roles }
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [failed, setFailed] = useState([]);

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
      const ids = await anki.invoke("findNotes", { query: `"deck:${cfg.deck}" "note:${cfg.model}"` });
      const infos = ids.length ? await anki.invoke("notesInfo", { notes: ids.slice(-20) }) : [];
      const guesses = guessFieldRoles(fieldNames, infos.map(flatFields));
      const roles = Object.fromEntries(fieldNames.map((f) => [f, guesses[f].role || "none"]));
      setDraft({ fieldNames, guesses, roles, noSamples: infos.length === 0 });
    } catch (e) {
      setCheckError(e.message);
    } finally {
      setChecking(false);
    }
  }

  function looksRight() {
    const mapping = buildMapping(draft.fieldNames, draft.guesses, draft.roles);
    setAnkiSettings({ mapping, fieldList: draft.fieldNames });
    setDraft(null);
  }

  const ready = Boolean(cfg.deck && cfg.model && Object.keys(cfg.mapping).length);
  const connected = a.status === "ok";

  return (
    <section className="settings">
      <h2 className="settings__title">Settings</h2>

      <div className="card">
        <h3 className="card__title">Anki</h3>
        <p className={`note ${a.status === "ok" ? "" : "note--error"}`} role="status">{STATUS_TEXT[a.status]}</p>
        {a.error && <p className="note note--error">{a.error}</p>}
        {!connected && a.status !== "checking" && (
          <>
            <ol className="settings__steps">
              <li>Open Anki on this computer.</li>
              <li>Install the AnkiConnect add-on (Tools, Add-ons, Get Add-ons, code 2055492159), then restart Anki.</li>
              <li>Press Connect and choose Yes in the box Anki shows.</li>
            </ol>
            <button className="btn btn--primary" onClick={a.connect}>Connect</button>
          </>
        )}

        {connected && (
          <>
            <div className="settings__row">
              <label className="settings__label" htmlFor="anki-deck">Deck</label>
              <select id="anki-deck" className="select" value={cfg.deck} onChange={(e) => pick({ deck: e.target.value })}>
                <option value="">Choose a deck…</option>
                {a.decks.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="settings__row">
              <label className="settings__label" htmlFor="anki-model">Note type</label>
              <select id="anki-model" className="select" value={cfg.model} onChange={(e) => pick({ model: e.target.value })}>
                <option value="">Choose a note type…</option>
                {a.models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="settings__row">
              <button className="btn" disabled={!cfg.deck || !cfg.model || checking} onClick={checkFields}>
                {checking ? "Checking…" : "Check fields"}
              </button>
              {ready && !draft && <span className="note settings__inline">{Object.keys(cfg.mapping).length} fields matched.</span>}
            </div>
            {checkError && <p className="note note--error">{checkError}</p>}
          </>
        )}

        {draft && (
          <div className="settings__table-wrap">
            {draft.noSamples && <p className="note">No notes of this type in that deck yet, so these are guesses from the field names.</p>}
            <table className="settings__table">
              <thead>
                <tr><th>Field</th><th>Role</th><th>Example</th></tr>
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
                        {lowConfidence(g) && role === g.role && <span className="settings__flag">Check this</span>}
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
              <button className="btn btn--primary" onClick={looksRight}>Looks right</button>
              <button className="btn btn--quiet" onClick={() => setDraft(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card__title">Saving and known words</h3>
        <label className="settings__toggle">
          <input
            type="checkbox"
            checked={ankiMode(state)}
            disabled={!ready}
            onChange={(e) => setAnkiSettings({ enabled: e.target.checked })}
          />
          <span>Send saves to Anki</span>
        </label>
        {!ready && <p className="note">Pick a deck and note type, then check the fields, to turn this on.</p>}
        {ready && (
          <p className="note">
            Saved words go to Anki instead of the Review tab. If Anki is closed, they wait here and go across later.
          </p>
        )}

        <div className="settings__row">
          <button className="btn" disabled={!ready || !connected || a.syncing} onClick={() => a.refreshKnown({ force: true })}>
            {a.syncing ? "Syncing…" : "Sync known words"}
          </button>
          <span className="note settings__inline">
            {Object.keys(state.anki.known).length} known, {Object.keys(state.anki.inDeck).length} in the deck. Last synced {ago(state.anki.syncedAt)}.
          </span>
        </div>

        <p className="note">
          {a.queueCount} {a.queueCount === 1 ? "card is" : "cards are"} waiting for Anki.
        </p>

        {failed.length > 0 && (
          <>
            <p className="note note--error">{failed.length} couldn't be sent:</p>
            <ul className="settings__failed">
              {failed.map((f) => (
                <li key={f.id}>
                  <span lang="ja">{plain(Object.values(f.note.fields || {})[0])}</span>
                  <span className="note settings__inline">{f.lastError}</span>
                  <button className="btn btn--quiet" onClick={() => retryFailed(f.id).then(() => { loadFailed(); a.refreshQueue(); })}>
                    Retry
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
