// Helper comun pentru toate funcțiile serverless din /api.
// Cheia AutoPartsAPI NU trebuie expusă niciodată către browser — de asta
// aceste apeluri se fac aici, pe server (Vercel Functions), nu direct din React.
//
// Variabile de mediu necesare (se configurează în Vercel → Settings → Environment Variables):
//   AUTOPARTS_BASE_URL  — adresa de bază primită din contul AutoPartsAPI (Console → Developer Settings)
//   AUTOPARTS_API_KEY   — cheia ta (Console → Developer Settings)

export async function fetchFromAutoPartsAPI(path) {
  const baseUrl = process.env.AUTOPARTS_BASE_URL;
  const apiKey = process.env.AUTOPARTS_API_KEY;

  if (!baseUrl || !apiKey) {
    const err = new Error(
      "AUTOPARTS_BASE_URL / AUTOPARTS_API_KEY nu sunt configurate în Vercel. " +
      "Adaugă-le în Settings → Environment Variables după ce te înregistrezi pe auto-parts-catalog.apiprofile.com."
    );
    err.code = "NOT_CONFIGURED";
    throw err;
  }

  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    headers: { "x-apiprofile-key": apiKey },
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(data.message || `AutoPartsAPI a răspuns cu status ${res.status}`);
    err.status = res.status;
    err.upstream = data;
    throw err;
  }

  return data;
}

export function sendError(res, err) {
  if (err.code === "NOT_CONFIGURED") {
    return res.status(503).json({ error: "not_configured", message: err.message });
  }
  return res.status(err.status || 500).json({ error: "upstream_error", message: err.message });
}
