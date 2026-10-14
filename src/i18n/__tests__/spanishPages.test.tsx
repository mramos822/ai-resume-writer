/**
 * Renders the pages in Spanish and looks for English text that is still on screen. It is an audit more than a test:
 * a page that shows a sentence of English fails, so a new untranslated text is noticed.
 */
import React from "react";
import { render } from "@testing-library/react";
import { LocaleProvider } from "@/i18n/provider";
import { ES } from "@/i18n/es";

jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => "/es/home",
    useSearchParams: () => new URLSearchParams(),
}));
jest.mock("react-markdown", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
jest.mock("@/lib/firebase", () => ({ auth: { currentUser: null }, db: {} }));
jest.mock("firebase/auth", () => ({
    getAuth: () => ({ currentUser: { displayName: "Alex Cook", email: "alex@example.com", metadata: { creationTime: "2026-01-01" }, providerData: [{ providerId: "password" }] } }),
    onAuthStateChanged: (_a: unknown, cb: (u: unknown) => void) => {
        cb({ displayName: "Alex Cook", email: "alex@example.com", metadata: { creationTime: "2026-01-01" }, providerData: [{ providerId: "password" }] });
        return () => {};
    },
    updateProfile: jest.fn(),
    updatePassword: jest.fn(),
    EmailAuthProvider: { credential: jest.fn() },
    reauthenticateWithCredential: jest.fn(),
    signOut: jest.fn(),
}));
jest.mock("firebase/firestore", () => ({ getFirestore: jest.fn(), doc: jest.fn(), setDoc: jest.fn() }));
jest.mock("@/context/authContext", () => ({ useAuth: () => ({ user: { uid: "u1", displayName: "Alex Cook", email: "alex@example.com" }, loading: false }) }));
jest.mock("@/context/themeContext", () => ({ useTheme: () => ({ theme: "light", setTheme: jest.fn() }) }));
jest.mock("@/lib/authFetch", () => ({
    authFetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]), blob: () => Promise.resolve(new Blob()) }),
}));
jest.mock("@/context/profileContext", () => {
    const actual = jest.requireActual("@/context/profileContext");
    const profile = {
        name: "Alex Cook",
        jobTitle: "Software Engineer",
        careerObjective: "",
        skills: ["React"],
        jobHistory: [],
        education: [],
        internships: [],
        projects: [],
        contactInfo: { email: "alex@example.com", phone: "", address: "" },
    };
    const base: Record<string, unknown> = {
        profiles: [{ id: "p1", name: "Alex Cook", data: profile }],
        activeProfileId: "p1",
        activeProfile: profile,
        hasUnsavedChanges: false,
    };
    const value = new Proxy(base, { get: (t, k: string) => (k in t ? t[k] : () => Promise.resolve()) });
    return { ...actual, useProfile: () => value, ProfileProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

beforeAll(() => {
    // jsdom has none of these
    (window as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} });
    class RO { observe() {} unobserve() {} disconnect() {} }
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = RO;
    Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
});

const spanish = new Set(Object.values(ES));
const looksEnglish = (t: string) =>
    /\b(the|and|your|you|for|with|to|of|in|is|are|not|this|that|can|will|please|it|from|on|or)\b/i.test(t) && !/[áéíóúñ¿¡]/i.test(t);

/** Visible English text left in the page. */
function leftovers(root: HTMLElement): string[] {
    const out = new Set<string>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
        const parent = (n as Text).parentElement;
        if (!parent || /SCRIPT|STYLE/.test(parent.tagName)) continue;
        const t = (n.textContent ?? "").replace(/\s+/g, " ").trim();
        if (t.length < 4 || spanish.has(t) || !looksEnglish(t)) continue;
        out.add(t.slice(0, 120));
    }
    root.querySelectorAll("[placeholder],[aria-label],[title],[alt]").forEach((el) => {
        for (const a of ["placeholder", "aria-label", "title", "alt"]) {
            const v = el.getAttribute(a);
            if (v && !spanish.has(v) && looksEnglish(v)) out.add(`${a}: ${v.slice(0, 100)}`);
        }
    });
    return [...out];
}

const pages: [string, () => Promise<{ default: React.ComponentType }>][] = [
    ["help", () => import("@/app/home/help/page")],
    ["settings", () => import("@/app/home/settings/page")],
    ["dashboard", () => import("@/app/home/page")],
    ["resumes", () => import("@/app/home/resumes/page")],
    ["job search", () => import("@/app/home/job-ads/page")],
    ["profile", () => import("@/app/home/profile/page")],
];

describe.each(pages)("%s in Spanish", (_name, load) => {
    it("shows no sentence of English", async () => {
        const { default: Page } = await load();
        const { container } = render(
            <LocaleProvider locale="es">
                <Page />
            </LocaleProvider>
        );
        await new Promise((r) => setTimeout(r, 50));
        expect(leftovers(container)).toEqual([]);
    });
});
