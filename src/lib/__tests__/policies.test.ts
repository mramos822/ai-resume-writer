import { isInactiveGuest, GUEST_INACTIVE_DAYS } from "../retentionRules";
import { isAdmin, adminEmails } from "../adminRules";

const DAY = 24 * 60 * 60 * 1000;

describe("retention promised in the privacy policy", () => {
    const now = Date.UTC(2026, 9, 10);

    it("deletes a guest that was not seen for more than 30 days", () => {
        expect(GUEST_INACTIVE_DAYS).toBe(30);
        expect(isInactiveGuest("guest-abc", now - 31 * DAY, now)).toBe(true);
    });

    it("keeps a guest that was seen recently", () => {
        expect(isInactiveGuest("guest-abc", now - 29 * DAY, now)).toBe(false);
    });

    it("never removes a real account for inactivity", () => {
        expect(isInactiveGuest("uid-123", now - 400 * DAY, now)).toBe(false);
    });

    it("keeps a guest whose last visit is unknown", () => {
        expect(isInactiveGuest("guest-abc", null, now)).toBe(false);
    });
});

describe("who counts as an administrator", () => {
    it("reads the list of emails", () => {
        expect(adminEmails(" A@x.com, b@y.com ,")).toEqual(["a@x.com", "b@y.com"]);
        expect(adminEmails(undefined)).toEqual([]);
    });

    it("needs a verified email that is on the list", () => {
        expect(isAdmin({ email: "A@x.com", email_verified: true }, "a@x.com")).toBe(true);
        expect(isAdmin({ email: "a@x.com", email_verified: false }, "a@x.com")).toBe(false);
        expect(isAdmin({ email: "other@x.com", email_verified: true }, "a@x.com")).toBe(false);
        expect(isAdmin({ email: "a@x.com", email_verified: true }, "")).toBe(false);
    });
});
