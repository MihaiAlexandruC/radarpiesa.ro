// GET /api/categories?vehicleId=19942&typeId=1&langId=4
// Proxy pentru: GET /api/category/type-id/{typeId}/products-groups-variant-4/{vehicleId}/lang-id/{langId}
// (varianta 4 = doar categoriile "frunză", exact ce trebuie pentru interogarea de piese)
import { fetchFromAutoPartsAPI, sendError } from "./_lib/autopartsapi.js";

export default async function handler(req, res) {
  const { vehicleId, typeId = "1", langId = "4" } = req.query;
  if (!vehicleId) {
    return res.status(400).json({ error: "bad_request", message: "Lipsește vehicleId" });
  }
  try {
    const data = await fetchFromAutoPartsAPI(
      /api/category/type-id/${typeId}/products-groups-variant-4/${vehicleId}/lang-id/${langId}
    );
    return res.status(200).json(data);
  } catch (err) {
    return sendError(res, err);
  }
}
