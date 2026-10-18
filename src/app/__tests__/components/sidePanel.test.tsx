import React from "react";
import { render, screen } from "@testing-library/react";
import SidePanel from "@/components/sidePanel";

// the admin check asks the server: here nobody is an admin
jest.mock("@/lib/authFetch", () => ({ authFetch: () => Promise.resolve({ ok: false }) }));

jest.mock("next/link", () => ({
    __esModule: true,
    default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

jest.mock("next/image", () => ({
    __esModule: true,
    // eslint-disable-next-line @next/next/no-img-element
    default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
        const rest = { ...props };
        delete rest.priority;
        return <img alt="" {...rest} />;
    },
}));

jest.mock("next/navigation", () => ({
    usePathname: () => "/home",
}));

// A profile with contact info and skills, but no objective, jobs or education yet
jest.mock("@/context/profileContext", () => ({
    useProfile: () => ({
        activeProfile: {
            name: "Test",
            jobTitle: "",
            contactInfo: { email: "a@b.com", phone: "", address: "" },
            careerObjective: "",
            skills: ["One", "Two", "Three"],
            jobHistory: [],
            education: [],
            internships: [],
            projects: [],
        },
    }),
}));

describe("SidePanel", () => {
    it("shows the main links and help", () => {
        render(<SidePanel isSidePanelOpen={true} onClose={() => {}} />);
        expect(screen.getByText("Dashboard")).toBeInTheDocument();
        expect(screen.getByText("Resumes")).toBeInTheDocument();
        expect(screen.getByText("Job Search")).toBeInTheDocument();
        expect(screen.getByText("Help & tutorials")).toBeInTheDocument();
        expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    it("is visible when open and off-screen when closed", () => {
        const { rerender } = render(<SidePanel isSidePanelOpen={true} onClose={() => {}} />);
        expect(screen.getByRole("complementary")).toHaveClass("translate-x-0");
        rerender(<SidePanel isSidePanelOpen={false} onClose={() => {}} />);
        expect(screen.getByRole("complementary")).toHaveClass("-translate-x-full");
    });

    it("stays fixed on desktop instead of scrolling with the page", () => {
        render(<SidePanel isSidePanelOpen={true} onClose={() => {}} />);
        expect(screen.getByRole("complementary")).toHaveClass("lg:sticky", "lg:top-0", "lg:h-screen");
    });

    it("reports profile strength and the next thing to fill in", () => {
        render(<SidePanel isSidePanelOpen={true} onClose={() => {}} />);
        // contact (20) + skills (20) = 40%
        expect(screen.getByText("40%")).toBeInTheDocument();
        expect(screen.getByText("Next: Objective")).toBeInTheDocument();
    });
});
