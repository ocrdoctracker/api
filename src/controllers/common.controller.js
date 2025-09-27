import { loadDocumentTypes } from "../services/common.service.js";
export async function getDocumentTypes(req, res) {
  return res.json({ success: true, data: loadDocumentTypes() });
}