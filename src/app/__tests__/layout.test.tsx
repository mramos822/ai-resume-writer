import React from "react";
import { render, screen } from "@testing-library/react";
import RootLayout, { generateMetadata } from "../layout";

// The providers need the browser and the network: here they just pass children through
jest.mock("@/app/providers", () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div data-testid="providers">{children}</div>,
}));
jest.mock("@/i18n/server", () => ({ getLocale: async () => "en" }));
jest.mock("next/font/google", () => ({
    Geist: () => ({ variable: "geist" }),
    Geist_Mono: () => ({ variable: "geist-mono" }),
}));

const originalConsoleError = console.error;

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation((msg, ...args) => {
        if (typeof msg === "string" && msg.includes("cannot be a child of")) return;
        originalConsoleError(msg, ...args);
    });
});

afterAll(() => {
    (console.error as jest.Mock).mockRestore();
});

describe("RootLayout", () => {
    it("renders the page inside the providers, with a skip link", async () => {
        const tree = await RootLayout({ children: <div data-testid="child">Hello</div> });
        render(tree);
        expect(screen.getByTestId("providers")).toBeInTheDocument();
        expect(screen.getByTestId("child")).toHaveTextContent("Hello");
        expect(screen.getByText("Skip to content")).toHaveAttribute("href", "#main");
    });

    it("describes the real product (not the template it came from)", async () => {
        const metadata = await generateMetadata();
        expect(JSON.stringify(metadata)).toContain("Kaizo");
        expect(JSON.stringify(metadata)).not.toContain("Marcus");
    });
});
