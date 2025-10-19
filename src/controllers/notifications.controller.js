import {
  getNotificationsByUser,
  createNotification,
  markNotificationRead,
  getTotalUnreadNotifByUser,
} from "../services/notifications.service.js";
import { READ_SUCCESS } from "../constants/notifications.constant.js";
import { getUserById } from "../services/user.service.js";
import { loadDocumentTypes } from "../services/common.service.js";
const documentTypes = loadDocumentTypes();
const documentTypesobj = Object.assign({}, ...documentTypes);

export async function getNotifications(req, res) {
  const { userId, pageSize, pageIndex } = req.query;
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
    const [notifications, totalUnread] = await Promise.all([
      getNotificationsByUser(userId, pageSize, pageIndex),
      getTotalUnreadNotifByUser(userId),
    ]);

    notifications.results.map((x) => {
      x.purpose = documentTypesobj[x.purpose];
      return x;
    });
    return res.json({ success: true, data: {
      ...notifications,
      totalUnread: Number(totalUnread?.count || 0)
    } });
  } catch (ex) {
    return res.status(400).json({ success: false, message: ex?.message });
  }
}

export async function markAsRead(req, res) {
  const { notificationId } = req.params;
  if (!notificationId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing notificationId params" });
  }

  let notification;

  try {
    notification = await markNotificationRead(notificationId);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data: notification, message: READ_SUCCESS });
}
