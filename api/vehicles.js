// GET /api/vehicles?modelId=5626&typeId=1&langId=4&countryFilterId=63
// Proxy pentru: GET /api/types/type-id/{typeId}/list-vehicles-types/{modelId}/lang-id/{langId}/country-filter-id/{countryFilterId}
import { fetchFromAutoPartsAPI, sendError } from "./_lib/autopartsapi.js";

export default async function handler(req, res) {
  const { modelId, typeId = "1", langId = "4", countryFilterId = "63" } = req.query;
  if (!modelId) {
    return res.status(400).json({ error: "bad_request", message: "Lipsește modelId" });
  }
  try {
    const data = await fetchFromAutoPartsAPI(
      `/api/types/type-id/${typeId}/list-vehicles-types/${modelId}/lang-id/${langId}/country-filter-id/${countryFilterId}`
    );
    res.setHeader("Cache-Control", "s-maxage=86400");
    return res.status(200).json(data);
  } catch (err) {
    return sendError(res, err);
  }
}
