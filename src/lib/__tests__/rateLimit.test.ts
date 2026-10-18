/** @jest-environment node */
import { limited } from "../rateLimit";

const req = (ip: string) => new Request("http://localhost/api/x", { headers: { "x-forwarded-for": ip } });

describe("rate limit", () => {
    it("lets requests through up to the limit, then answers 429 with Retry-After", async () => {
        for (let i = 0; i < 3; i++) expect(limited(req("1.1.1.1"), "t1", 3, 60_000)).toBeNull();
        const blocked = limited(req("1.1.1.1"), "t1", 3, 60_000);
        expect(blocked?.status).toBe(429);
        expect(Number(blocked?.headers.get("Retry-After"))).toBeGreaterThan(0);
    });

    it("counts each client apart", () => {
        for (let i = 0; i < 3; i++) limited(req("2.2.2.2"), "t2", 3, 60_000);
        expect(limited(req("3.3.3.3"), "t2", 3, 60_000)).toBeNull();
    });
});
