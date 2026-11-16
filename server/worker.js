// Cloudflare Worker entry: the handler plus D1, the email binding and Web Crypto randomness.
import { handle } from "./handler.js";

// The sign-in email, in the app's look: white paper, hairlines, one ink-blue rule, the code in mono.
// Tables and inline styles, because that's all email apps draw reliably.
export function emailHtml(code) {
  const font = "'Noto Sans JP','Hiragino Sans','Yu Gothic UI','Segoe UI',Helvetica,Arial,sans-serif";
  const mono = "'IBM Plex Mono',Consolas,'Courier New',monospace";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>Your sign-in code</title>
<style>@media (prefers-color-scheme: dark){.paper{background:#111317!important}.text{color:#e8e9ec!important}.soft{color:#9a9ea8!important}.rule{border-color:#2a2d33!important}}</style></head>
<body style="margin:0;padding:0;background:#fbfbfc" class="paper">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Your code is ${code}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="paper" style="background:#fbfbfc"><tr><td align="center" style="padding:48px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:440px">
<tr><td class="text" style="font-family:${font};font-size:15px;letter-spacing:3px;color:#15171c;padding-bottom:36px">mimitori</td></tr>
<tr><td class="text" style="font-family:${font};font-size:22px;line-height:1.4;color:#15171c;padding-bottom:12px">Your sign-in code</td></tr>
<tr><td class="text" style="font-family:${font};font-size:15px;line-height:1.7;color:#15171c;padding-bottom:24px">Type it into Mimitori to finish signing in. It works for 10 minutes.</td></tr>
<tr><td style="border-left:2px solid #2747d1;padding:6px 0 6px 18px;font-family:${mono};font-size:32px;letter-spacing:8px;color:#2747d1" class="text">${code}</td></tr>
<tr><td class="soft" style="font-family:${font};font-size:13px;line-height:1.7;color:#5d626c;padding-top:24px">Didn't ask for it? You can ignore this email. Nobody can sign in without the code.</td></tr>
<tr><td class="rule soft" style="border-top:1px solid #e3e5ea;margin-top:32px;padding-top:18px;font-family:${font};font-size:12px;color:#5d626c">
Mimitori · <a href="https://mimitori.com" class="soft" style="color:#5d626c">mimitori.com</a></td></tr>
</table></td></tr></table></body></html>`;
}

// Codes go out through Cloudflare Email Sending, from MAIL_FROM. TEST_MAILER = "1" logs them instead,
// for running the server on this PC.
const mailer = (env) => async (to, subject, text, code) => {
  if (env.TEST_MAILER === "1") return console.log(`code for ${to}: ${code}`);
  await env.EMAIL.send({ to, from: { email: env.MAIL_FROM, name: "Mimitori" }, subject, text, html: emailHtml(code) });
};

export default {
  fetch: (req, env) =>
    handle(req, {
      db: env.DB,
      mail: mailer(env),
      now: () => Date.now(),
      random: (n) => crypto.getRandomValues(new Uint8Array(n)),
    }),
};
