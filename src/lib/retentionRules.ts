// How long Kaizo keeps things. These numbers are promised in the Privacy Policy: if you change one, change the policy too.
export const GUEST_INACTIVE_DAYS = 30; // a guest (no account) who has not come back in this long is deleted
export const CONTACT_MESSAGE_MONTHS = 24; // contact-form messages are kept this long

const DAY = 24 * 60 * 60 * 1000;

/** True when a guest has not been seen for longer than the limit. `lastSeen` is when the person last signed in or refreshed. */
export function isInactiveGuest(uid: string, lastSeen: number | null, now = Date.now()): boolean {
  if (!uid.startsWith("guest-")) return false; // real accounts are never removed for inactivity
  if (lastSeen === null || Number.isNaN(lastSeen)) return false; // unknown: keep it
  return now - lastSeen > GUEST_INACTIVE_DAYS * DAY;
}
