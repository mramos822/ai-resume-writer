import admin from "@/lib/firebase-admin";
import { db } from "@/lib/mongodb";
import { deleteAccount } from "@/lib/accountData";
import { CONTACT_MESSAGE_MONTHS, isInactiveGuest } from "@/lib/retentionRules";

export { GUEST_INACTIVE_DAYS, CONTACT_MESSAGE_MONTHS, isInactiveGuest } from "@/lib/retentionRules";

/** Deletes guests that have been inactive for too long, with everything they made. */
export async function sweepInactiveGuests(max = 50): Promise<number> {
  let removed = 0;
  let pageToken: string | undefined;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    for (const u of page.users) {
      if (removed >= max) return removed;
      const seen = Math.max(Date.parse(u.metadata.lastRefreshTime || "") || 0, Date.parse(u.metadata.lastSignInTime || "") || 0, Date.parse(u.metadata.creationTime || "") || 0);
      if (!isInactiveGuest(u.uid, seen || null)) continue;
      try {
        await deleteAccount(u.uid, null);
        removed++;
      } catch (e) {
        console.error("Could not remove an inactive guest", e instanceof Error ? e.message : e);
      }
    }
    pageToken = page.pageToken;
  } while (pageToken && removed < max);
  return removed;
}

/** Deletes contact messages older than the retention period. */
export async function sweepOldMessages(): Promise<number> {
  const limit = new Date();
  limit.setMonth(limit.getMonth() - CONTACT_MESSAGE_MONTHS);
  const res = await db.collection("contact_messages").deleteMany({ createdAt: { $lt: limit } });
  return res.deletedCount ?? 0;
}

let last = 0;

/** Runs both cleanups at most once an hour per server. Never throws: it must not get in the way of the request that calls it. */
export async function sweepOnce(): Promise<void> {
  if (Date.now() - last < 60 * 60 * 1000) return;
  last = Date.now();
  try {
    await sweepInactiveGuests();
    await sweepOldMessages();
  } catch (e) {
    last = 0; // try again on the next call
    console.error("Retention sweep failed", e instanceof Error ? e.message : e);
  }
}
