"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextValue {
    user: User | null;
    loading: boolean;
    /** Someone is signed in but has not confirmed their email: the app treats that as "not signed in" on every page, and sends them to log in. */
    unverified: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [unverified, setUnverified] = useState(false);

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
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, unverified }}>
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