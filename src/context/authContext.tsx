"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

/** localStorage key with the last known answer ("1" signed in with an account, "0" not): lets the top banner draw the right buttons before Firebase finishes starting. */
export const SIGNED_IN_HINT = "kaizo:signed-in";

interface AuthContextValue {
    user: User | null;
    loading: boolean;
    /** Someone is signed in but has not confirmed their email: the app treats that as "not signed in" on every page, and sends them to log in. */
    unverified: boolean;
    /** The last known answer to "is an account signed in?", read from localStorage before Firebase has finished starting (null: never saved). Only for drawing buttons sooner; `user` is the truth. */
    signedInHint: boolean | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [unverified, setUnverified] = useState(false);
    const [signedInHint, setSignedInHint] = useState<boolean | null>(null);

    useLayoutEffect(() => {
        try {
            const v = localStorage.getItem(SIGNED_IN_HINT);
            if (v !== null) setSignedInHint(v === "1");
        } catch {}
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            // guests (sessions from /start) have no email to verify; see the note in app/start/page.tsx
            if (currentUser && (currentUser.emailVerified || currentUser.uid.startsWith("guest-"))) {
                setUser(currentUser);
                setUnverified(false);
            } else {
                setUser(null);
                setUnverified(Boolean(currentUser));
            }
            try {
                const account = !!currentUser && currentUser.emailVerified && !currentUser.uid.startsWith("guest-");
                localStorage.setItem(SIGNED_IN_HINT, account ? "1" : "0");
            } catch {}
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, unverified, signedInHint }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}