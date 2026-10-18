import React, { createContext, useContext, useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { usePathname } from "@/i18n/navigation";
import PageLoader from "@/components/pageLoader";
import { AnimatePresence } from "framer-motion";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

type ThemeType = "system" | "light" | "dark";

interface ThemeContextProps {
    theme: ThemeType;
    setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemeType>("system");
    const [authChecked, setAuthChecked] = useState(false);
    // the public pages (landing, log in, the legal pages and the contact form) show themselves right away, with no loading screen in front:
    // anyone must be able to read them without waiting for the account, and so can search engines (the loading screen hides the content from the server HTML)
    const pathname = usePathname();
    const isPublic = ["/", "/login", "/privacy", "/terms", "/cookies", "/accessibility", "/contact"].includes(pathname);

    // Save theme to Firestore when changed by the user
    const setTheme = async (newTheme: ThemeType) => {
        const root = document.documentElement;
        const dark = newTheme === "dark" || (newTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
        const apply = () => {
            root.classList.toggle("dark", dark);
            flushSync(() => setThemeState(newTheme));
        };
        // one cross-fade of the whole page (GPU) instead of animating every element's colors
        const start = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition;
        if (start && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) start.call(document, apply);
        else apply();
        localStorage.setItem("theme", newTheme);

        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
            try {
                const db = getFirestore();
                const userRef = doc(db, "users", user.uid);
                await setDoc(userRef, { theme: newTheme }, { merge: true });
            } catch (err) {
                console.error("Error saving theme to Firestore:", err);
            }
        }
    };

    // Load theme from Firestore for authenticated users
    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const db = getFirestore();
                    const userRef = doc(db, "users", user.uid);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const data = userSnap.data();
                        if (data.theme) {
                            setThemeState(data.theme);
                            localStorage.setItem("theme", data.theme); // Keep localStorage in sync
                        }
                    } else {
                        // First-time user: create document with default theme
                        await setDoc(userRef, { theme: "system" });
                        setThemeState("system");
                        localStorage.setItem("theme", "system");
                    }
                } catch (err) {
                    // the theme also lives in this browser: when the account document cannot be read (rules, offline) the saved one is used
                    const code = (err as { code?: string })?.code;
                    if (code !== "permission-denied" && code !== "unavailable") console.error("Error loading theme from Firestore:", err);
                    const saved = localStorage.getItem("theme") as ThemeType | null;
                    if (saved) setThemeState(saved);
                }
            } else {
                // Not signed in, fall back to localStorage or system
                const savedTheme = (localStorage.getItem("theme") as ThemeType) || "system";
                setThemeState(savedTheme);
            }
            setAuthChecked(true); // <-- Set to true after auth check
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;

        const applyTheme = (selectedTheme: ThemeType) => {
            if (selectedTheme === "light") {
                root.classList.remove("dark");
            } else if (selectedTheme === "dark") {
                root.classList.add("dark");
            } else if (selectedTheme === "system") {
                const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                if (prefersDark) {
                    root.classList.add("dark");
                } else {
                    root.classList.remove("dark");
                }
            }
        };

        // until the account's theme is known, the one saved in this browser is used (the loading screen must not flash the wrong mode);
        // nothing is written to localStorage here: setTheme and the account load do that, so a first "system" never overwrites the choice
        const saved = localStorage.getItem("theme") as ThemeType | null;
        applyTheme(!authChecked && saved ? saved : theme);

        // Add a listener for system theme changes if "system" is selected
        let mediaQuery: MediaQueryList | null = null;
        const handleSystemThemeChange = (e: MediaQueryListEvent) => {
            if (theme === "system") {
                applyTheme(e.matches ? "dark" : "light");
            }
        };

        if (theme === "system") {
            mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            mediaQuery.addEventListener("change", handleSystemThemeChange);
        }

        // Cleanup the listener on unmount or when the theme changes
        return () => {
            if (mediaQuery) {
                mediaQuery.removeEventListener("change", handleSystemThemeChange);
            }
        };
    }, [theme, authChecked]);

    // Images stay where they are: no dragging them out (Firefox ignores the CSS rule) and no right-click menu on them
    // ("Save image as", "Copy image"). The rest of the page keeps its normal right-click menu.
    useEffect(() => {
        const stop = (e: Event) => {
            if (e.target instanceof HTMLImageElement) e.preventDefault();
        };
        document.addEventListener("dragstart", stop);
        document.addEventListener("contextmenu", stop);
        return () => {
            document.removeEventListener("dragstart", stop);
            document.removeEventListener("contextmenu", stop);
        };
    }, []);

    const waiting = !authChecked && !isPublic;

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {!waiting && children}
            {/* the loading screen fades away instead of vanishing, while the page appears under it */}
            <AnimatePresence>{waiting && <PageLoader key="loader" />}</AnimatePresence>
        </ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextProps => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};