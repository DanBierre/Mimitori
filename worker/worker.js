// Cloudflare Worker — holds the DeepL API key server-side.
// The Chrome extension calls THIS endpoint. This worker calls DeepL.
//
// Deploy steps are in worker/README.md.

export default {
  async fetch(request, env) {
    // --- CORS ---
    // Chrome extensions send requests with an Origin like chrome-extension://<id>.
    // We allow that here. Tighten this to your specific extension ID once you
    // know it (see worker/README.md) if you want to lock it down further.
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Must be a string (a number or object would throw on .trim) and short:
    // every character is billed against the DeepL quota.
    const MAX_TEXT = 2000;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text || text.length > MAX_TEXT) {
      return new Response(
        JSON.stringify({ error: text ? `'text' is over ${MAX_TEXT} characters` : "Missing 'text' field" }),
        { status: text ? 413 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // DEEPL_API_KEY is set as a secret (see worker/README.md) — never hardcode it here.
    if (!env.DEEPL_API_KEY) {
      return new Response(JSON.stringify({ error: "Server not configured (missing DEEPL_API_KEY)" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Free-tier DeepL keys end in ":fx" and must use the api-free host.
    const isFreeKey = env.DEEPL_API_KEY.trim().endsWith(":fx");
    const deeplUrl = isFreeKey
      ? "https://api-free.deepl.com/v2/translate"
      : "https://api.deepl.com/v2/translate";

    try {
      const deeplRes = await fetch(deeplUrl, {
        method: "POST",
        headers: {
          "Authorization": `DeepL-Auth-Key ${env.DEEPL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: [text],
          source_lang: "JA",
          target_lang: "EN",
        }),
      });

      if (!deeplRes.ok) {
        const errText = await deeplRes.text();
        return new Response(JSON.stringify({ error: `DeepL error: ${errText}` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const deeplData = await deeplRes.json();
      const translation = deeplData.translations?.[0]?.text || "";

      // DeepL doesn't provide furigana/readings — that's step 2 in the README
      // (a separate Japanese morphological analysis step). Leave blank for now.
      return new Response(JSON.stringify({ reading: "", translation }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: `Request failed: ${err.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
