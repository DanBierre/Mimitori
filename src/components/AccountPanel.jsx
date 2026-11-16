// AccountPanel.jsx
// Sign in with email and password, then sync. An emailed code makes the account or resets the password. Opens from the account button in the header.
import { useState } from "react";
import { useT } from "../lib/store";
import { useAccount } from "../lib/useSync";

export default function AccountPanel() {
  const t = useT();
  const { account, status, sync, startSignIn, finishSignIn, logIn, signOut, deleteAccount } = useAccount();
  const [mode, setMode] = useState("password"); // or "code": for a new account or a forgotten password
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const run = (fn) => async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (account) {
    const when = status.at && new Date(status.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return (
      <div className="settings__section">
        <h3 className="settings__heading">{t("Account")}</h3>
        <p className="note">{t("Signed in as {email}. Your words, known words and settings sync to your other devices.", { email: account.email })}</p>
        <p className="settings__hint" aria-live="polite">
          {status.busy ? t("Syncing…") : status.error ? t(status.error) : when ? t("Last synced at {time}", { time: when }) : ""}
        </p>
        <div className="settings__row">
          <button className="btn" onClick={() => sync()} disabled={status.busy}>{t("Sync now")}</button>
          <button className="btn btn--quiet" onClick={run(signOut)} disabled={busy}>{t("Sign out")}</button>
          <button className="btn btn--quiet" onClick={() => setConfirming(true)}>{t("Delete account")}</button>
        </div>
        {error && <p className="note note--error">{t(error)}</p>}
        {confirming && (
          <div role="alert">
            <p className="note">{t("This deletes your account and the copy of your words on our server. The words on this device stay put.")}</p>
            <div className="settings__row">
              <button className="btn btn--primary" onClick={run(deleteAccount)} disabled={busy}>{t("Delete account")}</button>
              <button className="btn btn--quiet" onClick={() => setConfirming(false)}>{t("Cancel")}</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const toCode = () => { setMode("code"); setSent(false); setCode(""); setPassword(""); setError(""); };
  const emailField = (
    <>
      <label className="settings__label" htmlFor="account-email">{t("Email")}</label>
      <input id="account-email" className="text-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
    </>
  );

  return (
    <div className="settings__section">
      <h3 className="settings__heading">{t(mode === "password" ? "Account" : "New account or password")}</h3>
      {mode === "password" ? (
        <>
          <p className="note">{t("Your words live on this device only. Sign in to keep them on all your devices.")}</p>
          <form className="settings__row" onSubmit={run(() => logIn(email.trim(), password))}>
            {emailField}
            <label className="settings__label" htmlFor="account-password">{t("Password")}</label>
            <input id="account-password" className="text-input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn btn--primary" disabled={busy || !email.trim() || !password}>{t("Sign in")}</button>
          </form>
          <button type="button" className="btn btn--quiet" onClick={toCode}>{t("New here, or forgot your password?")}</button>
        </>
      ) : !sent ? (
        <>
          <p className="note">{t("We'll email you a code to check the address is yours. Then you pick a password.")}</p>
          <form className="settings__row" onSubmit={run(async () => { await startSignIn(email.trim()); setSent(true); })}>
            {emailField}
            <button className="btn btn--primary" disabled={busy || !email.trim()}>{t("Send code")}</button>
          </form>
          <button type="button" className="btn btn--quiet" onClick={() => { setMode("password"); setError(""); }}>{t("Back to sign in")}</button>
        </>
      ) : (
        <>
          <p className="note">{t("We sent a code to {email}. It works for 10 minutes.", { email: email.trim() })}</p>
          <form className="settings__row" onSubmit={run(() => finishSignIn(email.trim(), code, password))}>
            <label className="settings__label" htmlFor="account-code">{t("Code")}</label>
            <input id="account-code" className="text-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <label className="settings__label" htmlFor="account-new-password">{t("New password, 8 characters or more")}</label>
            <input id="account-new-password" className="text-input" type="password" autoComplete="new-password" minLength={8} maxLength={200} required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn btn--primary" disabled={busy || code.length !== 6 || password.length < 8}>{t("Save and sign in")}</button>
          </form>
          <button type="button" className="btn btn--quiet" onClick={toCode}>{t("Use a different email")}</button>
        </>
      )}
      {error && <p className="note note--error">{t(error)}</p>}
    </div>
  );
}
