import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import HomeLayout from "@/app/home/layout";

jest.mock("@/components/topBanner", () => ({
    __esModule: true,
    default: ({ toggleSidePanel }: { toggleSidePanel: () => void }) => (
        <div data-testid="top-banner">
            TopBanner
            <button onClick={toggleSidePanel}>Toggle</button>
        </div>
    ),
}));
jest.mock("@/components/sidePanel", () => ({
    __esModule: true,
    default: ({ isSidePanelOpen }: { isSidePanelOpen: boolean }) => (
        <div data-testid="side-panel">{isSidePanelOpen ? "Open" : "Closed"}</div>
    ),
}));
jest.mock("@/components/guidedTour", () => ({
    __esModule: true,
    default: () => <div data-testid="tour" />,
}));

// Providers are exercised elsewhere; here they just pass children through
jest.mock("@/context/toastContext", () => ({
    ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/context/dialogContext", () => ({
    DialogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/context/profileContext", () => ({
    ProfileProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("HomeLayout", () => {
    it("renders TopBanner, SidePanel, the tour and children", () => {
        render(
            <HomeLayout>
                <div data-testid="main-content">Main Content</div>
            </HomeLayout>
        );
        expect(screen.getByTestId("top-banner")).toBeInTheDocument();
        expect(screen.getByTestId("side-panel")).toHaveTextContent("Open");
        expect(screen.getByTestId("tour")).toBeInTheDocument();
        expect(screen.getByTestId("main-content")).toBeInTheDocument();
    });

    it("toggles the side panel from the top banner", () => {
        render(
            <HomeLayout>
                <div />
            </HomeLayout>
        );
        fireEvent.click(screen.getByText("Toggle"));
        expect(screen.getByTestId("side-panel")).toHaveTextContent("Closed");
    });
});
