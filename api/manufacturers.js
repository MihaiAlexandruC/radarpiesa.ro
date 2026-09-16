// GET /api/manufacturers?typeId=1
// Proxy pentru: GET /api/manufacturers/list/type-id/{typeId}
import { fetchFromAutoPartsAPI, sendError } from "./_lib/autopartsapi.js";

export default async function handler(req, res) {
  const typeId = req.query.typeId || "1"; // 1 = mașini de pasageri
  try {
    const data = await fetchFromAutoPartsAPI(`/api/manufacturers/list/type-id/${typeId}`);
    res.setHeader("Cache-Control", "s-maxage=86400"); // brandurile se schimbă rar, cache 24h
    return res.status(200).json(data);
  } catch (err) {
    return sendError(res, err);
  }
}
