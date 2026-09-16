// GET /api/parts?vehicleId=19942&categoryId=100260&typeId=1&langId=4
// Proxy pentru: GET /api/articles/list/type-id/{typeId}/vehicle-id/{vehicleId}/category-id/{categoryId}/lang-id/{langId}
import { fetchFromAutoPartsAPI, sendError } from "./_lib/autopartsapi.js";

export default async function handler(req, res) {
  const { vehicleId, categoryId, typeId = "1", langId = "4" } = req.query;
  if (!vehicleId || !categoryId) {
    return res.status(400).json({ error: "bad_request", message: "Lipsește vehicleId sau categoryId" });
  }
  try {
    const data = await fetchFromAutoPartsAPI(
      `/api/articles/list/type-id/${typeId}/vehicle-id/${vehicleId}/category-id/${categoryId}/lang-id/${langId}`
    );
    return res.status(200).json(data);
  } catch (err) {
    return sendError(res, err);
  }
}
