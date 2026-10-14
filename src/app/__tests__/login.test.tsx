import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import LandingPage from "../login/page";
import type { MockAuth } from "@/types/auth";

// Mock next/image to avoid Next.js SSR issues
jest.mock("next/image", () => ({
    __esModule: true,
    // eslint-disable-next-line @next/next/no-img-element
    default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
        const rest = { ...props };
        delete rest.priority;
        return <img alt="" {...rest} />;
    },
}));

const pushMock = jest.fn();
const replaceMock = jest.fn();
// Next's real router object is stable between renders; a fresh one each time would re-run the page's effects
const routerMock = { push: pushMock, replace: replaceMock };
jest.mock("next/navigation", () => ({
    useRouter: () => routerMock,
    usePathname: () => "/login",
}));

// Variable to control useAuth mock
let mockAuthValue: MockAuth = { user: null, loading: false };
jest.mock("@/context/authContext", () => ({
    useAuth: () => mockAuthValue,
}));

// the live counter opens a server connection, which is tested apart
jest.mock("@/components/liveResumeCount", () => ({ __esModule: true, default: () => <div data-testid="live-count" /> }));

type LoginFormProps = { onLogin: () => void; onForgotPassword: () => void };
type RegistrationFormProps = { onRegister: () => void };
type ResetPasswordFormProps = { onSuccess: () => void };

jest.mock("@/components/forms/loginForm", () => ({
    LoginForm: ({ onLogin, onForgotPassword }: LoginFormProps) => (
        <div>
            <button onClick={onLogin}>Login</button>
            <button onClick={onForgotPassword}>Forgot Password</button>
        </div>
    ),
}));
jest.mock("@/components/forms/registrationForm", () => ({
    RegistrationForm: ({ onRegister }: RegistrationFormProps) => (
        <div>
            <button onClick={onRegister}>Register</button>
        </div>
    ),
}));
jest.mock("@/components/forms/resetPasswordForm", () => ({
    ResetPasswordForm: ({ onSuccess }: ResetPasswordFormProps) => (
        <div>
            <button onClick={onSuccess}>Reset Password</button>
        </div>
    ),
}));

function openWithView(view: string | null) {
    window.history.pushState({}, "", view ? `/login?view=${view}` : "/login");
}

describe("Sign-in page", () => {
    beforeEach(() => {
        pushMock.mockClear();
        replaceMock.mockClear();
        mockAuthValue = { user: null, loading: false };
        openWithView("login");
    });

    it("shows the login form by default", () => {
        render(<LandingPage />);
        expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
        expect(screen.getByText("Login")).toBeInTheDocument();
    });

    it("shows the login form when there is no ?view=", () => {
        openWithView(null);
        render(<LandingPage />);
        expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    });

    it("switches to the registration form", () => {
        render(<LandingPage />);
        fireEvent.click(screen.getByText("Create a free account"));
        expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
        expect(screen.getByText("Register")).toBeInTheDocument();
    });

    it("switches to the reset password form", () => {
        render(<LandingPage />);
        fireEvent.click(screen.getByText("Forgot Password"));
        expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
        expect(screen.getByText("Reset Password")).toBeInTheDocument();
    });

    it("returns to login from registration", () => {
        render(<LandingPage />);
        fireEvent.click(screen.getByText("Create a free account"));
        fireEvent.click(screen.getByText("Log in"));
        expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    });

    it("returns to login from reset password", () => {
        render(<LandingPage />);
        fireEvent.click(screen.getByText("Forgot Password"));
        fireEvent.click(screen.getByText("Back to log in"));
        expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    });

    it("redirects to /home if the user is already signed in", () => {
        mockAuthValue = { user: { uid: "123" }, loading: false };
        render(<LandingPage />);
        expect(pushMock).toHaveBeenCalledWith("/home");
    });

    it("shows a spinner while auth is loading", () => {
        mockAuthValue = { user: null, loading: true };
        const { container } = render(<LandingPage />);
        expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    });
});
