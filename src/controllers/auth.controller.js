import { compare } from '../utils/utils.js';
import {
  ERROR_USER_NOT_FOUND,
  ERROR_PASSWORD_INCORRECT,
} from '../constants/auth.constant.js';
import { findActiveUserByUsername } from '../services/auth.service.js';
import {
  getTotalUnreadNotifByUser,
} from "../services/notifications.service.js";

import NodeCache from "node-cache";
// Cache (TTL = 60s)
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// Key helpers
export const KEY_NOTIF_LIST = (userId, pageIndex, pageSize) =>
  `notif:list:${userId}:p${pageIndex}:s${pageSize}`;
export const KEY_NOTIF_COUNT = (userId) => `notif:count:${userId}`;
export const KEY_NOTIF_INDEX = (userId) => `notif:index:${userId}`;

// Helper to invalidate ALL notification-related cache for a user
function clearUserNotificationsCache(userId) {
  const uid = String(userId);
  const idxKey = KEY_NOTIF_INDEX(uid);
  const arr = cache.get(idxKey) || [];

  // Delete all cached pages for that user
  if (arr.length) cache.del(arr);

  // Delete the page index itself
  cache.del(idxKey);

  // Delete count (totalUnread)
  cache.del(KEY_NOTIF_COUNT(uid));

  console.log(`[Cache] Cleared all notification cache for user ${uid}`);
}

export async function login(req, res) {
  const { username, password } = req.body;

  const user = await findActiveUserByUsername(username);
  if (!user) {
    return res.status(401).json({ success: false, message: ERROR_USER_NOT_FOUND });
  }

  const isMatch = await compare(user.password , password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: ERROR_PASSWORD_INCORRECT });
  }

  if(!user?.department) {
    return res.status(401).json({ success: false, message: "User does not have access!" });
  }
  clearUserNotificationsCache(user?.userId);
  const totalUnread = await getTotalUnreadNotifByUser(user?.userId);

  user.totalUnreadNotif = totalUnread;

  delete user.password;
  delete user.currentOtp;

  return res.json({ success: true, data: user });
}