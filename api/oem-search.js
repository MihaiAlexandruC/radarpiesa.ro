// GET /api/oem-search?code=8F0513035N&langId=4
// Proxy pentru: GET /api/articles-oem/search-by-article-oem-no?articleOemNo=...&langId=...
import { fetchFromAutoPartsAPI, sendError } from "./_lib/autopartsapi.js";

export default async function handler(req, res) {
  const { code, langId = "4" } = req.query;
  if (!code) {
    return res.status(400).json({ error: "bad_request", message: "Lipsește parametrul code" });
  }
  try {
    const data = await fetchFromAutoPartsAPI(
      `/api/articles-oem/search-by-article-oem-no?articleOemNo=${encodeURIComponent(code)}&langId=${langId}`
    );
    return res.status(200).json(data);
  } catch (err) {
    return sendError(res, err);
  }
}
