import {
  searchDocRequest, searchDocRequestAttachment
} from "../services/search.service.js";
import { getUserById } from "../services/user.service.js";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 30, checkperiod: 120 });

export async function search(req, res) {
  const keyword = String(req.query.q || "");
  const userId = Number(req.query.userId || 0);
  const filter = req?.query?.filter || [];

  const docRequest = filter.some(x=> x === "docRequest");
  const file = filter.some(x=> x === "file");

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing userId params" });
  }

  try {
    const user = await getUserById(userId);
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: ERROR_USER_NOT_FOUND });
    }

    const data = {
      docRequest: docRequest ? await searchDocRequest(keyword, userId) : null,
      file: file ? await searchDocRequestAttachment(keyword, userId) : null
    };

    return res.json({ success: true, data });
  } catch (ex) {
    return res.status(400).json({ success: false, message: ex?.message });
  }
}

