import {
  getNotificationsByUser,
  createNotification,
  markNotificationRead,
  getTotalUnreadNotifByUser,
} from "../services/notifications.service.js";
import { READ_SUCCESS } from "../constants/notifications.constant.js";
import { getUserById } from "../services/user.service.js";
import { loadDocumentTypes } from "../services/common.service.js";
import { ERROR_USER_NOT_FOUND } from "../constants/user.constant.js"; // ensure this exists
import NodeCache from "node-cache";

// -----------------------------------------------------------------------------
// Cache (TTL = 60s)
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// Key builders
const KEY_NOTIF_LIST = (userId, pageIndex, pageSize) =>
  `notif:list:${userId}:p${pageIndex}:s${pageSize}`;
const KEY_NOTIF_COUNT = (userId) => `notif:count:${userId}`;
const KEY_NOTIF_INDEX = (userId) => `notif:index:${userId}`; // tracks cached list keys per user

// Helpers to track/invalidate/patch cached pages for a user
function registerListKey(userId, listKey) {
  const idxKey = KEY_NOTIF_INDEX(userId);
  const arr = cache.get(idxKey) || [];
  if (!arr.includes(listKey)) {
    arr.push(listKey);
    cache.set(idxKey, arr);
  }
}
function invalidateUserLists(userId) {
  const idxKey = KEY_NOTIF_INDEX(userId);
  const arr = cache.get(idxKey) || [];
  if (arr.length) cache.del(arr);
  cache.del(idxKey);
}
function getItemId(n) {
  // Normalize to string and support common id field names
  return String(n?.id ?? n?.notificationId ?? n?.notifId ?? n?._id ?? "");
}

function getResultsFromPage(page) {
  // Support either { results: [...] } or { data: { results: [...] } }
  if (Array.isArray(page?.results)) {
    return { kind: "results", arr: page.results };
  }
  if (Array.isArray(page?.data?.results)) {
    return { kind: "data.results", arr: page.data.results };
  }
  return { kind: null, arr: null };
}

function setResultsOnPage(page, kind, newArr) {
  if (kind === "results") {
    return { ...page, results: newArr };
  }
  if (kind === "data.results") {
    return { ...page, data: { ...page.data, results: newArr } };
  }
  return page;
}

function listKeysForUserFromIndex(userId) {
  const idxKey = KEY_NOTIF_INDEX(userId);
  return cache.get(idxKey) || [];
}

function listKeysForUserByScan(userId) {
  // Fallback if index is empty or stale
  const prefix = `notif:list:${userId}:`;
  return cache.keys().filter((k) => k.startsWith(prefix));
}

/**
 * Patch a notification across all cached pages for a user.
 * - Normalizes IDs to strings
 * - Supports {results} and {data:{results}}
 * - Falls back to scanning cache keys if the index is missing
 * Returns { pagesTouched, itemsPatched }
 */
function patchNotificationInCachedLists(userId, notificationId, patchFn) {
  const targetId = String(notificationId);

  // get all candidate page keys
  let keys = listKeysForUserFromIndex(userId);
  if (!keys.length) {
    // index might be missing; do a safe scan
    keys = listKeysForUserByScan(userId);
  }

  let pagesTouched = 0;
  let itemsPatched = 0;

  for (const k of keys) {
    const page = cache.get(k);
    if (!page) continue;

    const { kind, arr } = getResultsFromPage(page);
    if (!kind || !Array.isArray(arr) || !arr.length) continue;

    let changed = false;
    const patched = arr.map((n) => {
      if (getItemId(n) === targetId) {
        changed = true;
        itemsPatched++;
        return patchFn({ ...n });
      }
      return n;
    });

    if (changed) {
      pagesTouched++;
      const newPage = setResultsOnPage(page, kind, patched);
      cache.set(k, newPage); // refresh TTL for this page
    }
  }

  // Optional: if we didn’t patch anything, you can invalidate to be safe
  // if (itemsPatched === 0) invalidateUserLists(userId);

  // Debug (remove if noisy)
  // console.debug(`[Cache] patchNotificationInCachedLists user=${userId} id=${targetId} pagesTouched=${pagesTouched} itemsPatched=${itemsPatched}`);

  return { pagesTouched, itemsPatched };
}

// -----------------------------------------------------------------------------

// Document types mapping
const documentTypes = loadDocumentTypes();
const documentTypesobj = Object.assign({}, ...documentTypes);

// -----------------------------------------------------------------------------

export async function getNotifications(req, res) {
  const userId = String(req.query.userId || "");
  const pageSize = Number.isFinite(+req.query.pageSize)
    ? +req.query.pageSize
    : 10;
  const pageIndex = Number.isFinite(+req.query.pageIndex)
    ? +req.query.pageIndex
    : 0;

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

    const listKey = KEY_NOTIF_LIST(userId, pageIndex, pageSize);
    const countKey = KEY_NOTIF_COUNT(userId);

    // Serve list from cache if present
    const cachedPage = cache.get(listKey);
    if (cachedPage) {
      const cachedCount = cache.get(countKey);
      return res.json({
        success: true,
        data: {
          ...cachedPage,
          totalUnread: Number(
            cachedCount ?? cachedPage.totalUnread ?? 0
          ),
        },
      });
    }

    // Fetch fresh
    const [notifications, totalUnread] = await Promise.all([
      getNotificationsByUser(userId, pageSize, pageIndex),
      getTotalUnreadNotifByUser(userId),
    ]);

    // Map purposes using your dictionary
    notifications.results = notifications.results.map((x) => ({
      ...x,
      purpose: documentTypesobj[x.purpose] ?? x.purpose,
    }));

    const data = {
      ...notifications,
      totalUnread: Number(totalUnread || 0),
    };

    // Cache page and register it for this user
    cache.set(listKey, data);
    registerListKey(userId, listKey);

    cache.set(countKey, Number(totalUnread || 0));

    return res.json({ success: true, data });
  } catch (ex) {
    return res.status(400).json({ success: false, message: ex?.message });
  }
}

export async function getTotalUnreadNotif(req, res) {
  const userId = String(req.params.userId || "");
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

    const countKey = KEY_NOTIF_COUNT(userId);
    const fromCache = cache.get(countKey);
    if (fromCache) {
      return res.json({ success: true, data: fromCache });
    }

    const totalUnread = await getTotalUnreadNotifByUser(userId);
    cache.set(countKey, totalUnread);
    return res.json({ success: true, data: totalUnread });
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

  let totalUnread = 0;

  try {
    const notification = await markNotificationRead(notificationId);

    // Ensure we have a userId to target cached pages
    const userId = String(notification.userId ?? req.user?.id ?? "");
    if (userId) {
      // Optimistically adjust unread count
      const countKey = KEY_NOTIF_COUNT(userId);
      const cachedCount = cache.get(countKey);
      if (cachedCount && typeof cachedCount === "number") {
        totalUnread = Math.max(0, cachedCount - 1);
        cache.set(countKey, totalUnread);
      } else {
        cache.del(countKey); // force refresh next time
        totalUnread = await getTotalUnreadNotifByUser(userId);
        cache.set(countKey, totalUnread);
      }

      // Patch across cached pages. If nothing patched, invalidate pages as fallback.
      patchNotificationInCachedLists(
        userId,
        notificationId,
        (n) => ({
          ...n,
          isRead: true,
          readAt: notification.readAt ?? new Date().toISOString(),
        }),
        { fallbackInvalidate: true }
      );
    } else {
      // If we can’t resolve the user, safest is to skip patching and let next fetch refresh.
      console.warn(
        `[Cache] markAsRead: no userId available for notification ${notificationId}; skip patch`
      );
    }

    return res.json({
      success: true,
      data: {
        notification,
        totalUnread
      },
      message: READ_SUCCESS,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

// -----------------------------------------------------------------------------
// Call this after DB insert whenever a new notification for a user is created.
// You can also wrap `createNotification` to call this automatically.
export function onNotificationCreated(userId) {
  const uid = String(userId);
  invalidateUserLists(uid); // page caches are stale (ordering may change)
  const countKey = KEY_NOTIF_COUNT(uid);
  const cachedCount = cache.get(countKey);
  if (cachedCount && typeof cachedCount === "number") {
    cache.set(countKey, cachedCount + 1);
  } else {
    cache.del(countKey); // force refresh next time
  }
}
