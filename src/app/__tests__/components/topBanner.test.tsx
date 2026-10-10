import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TopBanner from "@/components/topBanner";

jest.mock("next/link", () => ({
    __esModule: true,
    default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => "/home",
}));

jest.mock("firebase/auth", () => ({
    signOut: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/lib/firebase", () => ({ auth: {} }));

let mockUser: { displayName?: string | null; email?: string | null } | null = {
    displayName: "Jane Doe",
    email: "jane@example.com",
};
jest.mock("@/context/authContext", () => ({
    useAuth: () => ({ user: mockUser, loading: false }),
}));

// The guided tour opener is just a function; the real one dispatches a window event
jest.mock("@/components/guidedTour", () => ({ openTour: jest.fn() }));

// the day / night switch needs the app's theme provider, which is exercised elsewhere
jest.mock("@/components/themeSwitch", () => ({ __esModule: true, default: () => <div data-testid="theme-toggle" /> }));

describe("TopBanner", () => {
    beforeEach(() => {
        mockUser = { displayName: "Jane Doe", email: "jane@example.com" };
    });

    it("shows the current page title", () => {
        render(<TopBanner toggleSidePanel={() => {}} />);
        expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    it("has a quick 'New resume' shortcut", () => {
        render(<TopBanner toggleSidePanel={() => {}} />);
        expect(screen.getByRole("link", { name: /new resume/i })).toHaveAttribute("href", "/home/resumes/new");
    });

    it("calls toggleSidePanel when the menu button is clicked", () => {
        const toggle = jest.fn();
        render(<TopBanner toggleSidePanel={toggle} />);
        fireEvent.click(screen.getByLabelText("Toggle menu"));
        expect(toggle).toHaveBeenCalledTimes(1);
    });

    it("shows the user's initials", () => {
        render(<TopBanner toggleSidePanel={() => {}} />);
        expect(screen.getByText("JD")).toBeInTheDocument();
    });

    it("falls back to the email name for a single-name user", () => {
        mockUser = { displayName: "Cher", email: "cher@example.com" };
        render(<TopBanner toggleSidePanel={() => {}} />);
        expect(screen.getByText("C")).toBeInTheDocument();
    });
});
