// GET /api/models?manufacturerId=16&typeId=1&langId=4&countryFilterId=63
// Proxy pentru: GET /api/models/list/type-id/{typeId}/manufacturer-id/{manufacturerId}/lang-id/{langId}/country-filter-id/{countryFilterId}
import { fetchFromAutoPartsAPI, sendError } from "./_lib/autopartsapi.js";

export default async function handler(req, res) {
  const { manufacturerId, typeId = "1", langId = "4", countryFilterId = "63" } = req.query;
  if (!manufacturerId) {
    return res.status(400).json({ error: "bad_request", message: "Lipsește manufacturerId" });
  }
  try {
    const data = await fetchFromAutoPartsAPI(
      `/api/models/list/type-id/${typeId}/manufacturer-id/${manufacturerId}/lang-id/${langId}/country-filter-id/${countryFilterId}`
    );
    res.setHeader("Cache-Control", "s-maxage=86400");
    return res.status(200).json(data);
  } catch (err) {
    return sendError(res, err);
  }
}
