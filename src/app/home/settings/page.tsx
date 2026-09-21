"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation"; // Import useRouter for navigation
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button"; // Assuming you have a Button component
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { useTheme } from "@/context/themeContext"; // Import the useTheme hook
import { getAuth, onAuthStateChanged, updateProfile } from "firebase/auth"; // Import Firebase Auth
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { getFriendlyFirebaseErrorMessage } from "@/utils/firebaseErrorHandler";
import PageHeader from "@/components/pageHeader";
import { UserRound, Palette, KeyRound, Info } from "lucide-react";

type ThemeType = "light" | "dark" | "system";

export default function SettingsPage() {
    const { theme, setTheme } = useTheme(); // Use the global theme context
    const [name, setName] = useState<string>(""); // State for the user's name
    const [email, setEmail] = useState<string>(""); // State for the user's email
    const [isSaving, setIsSaving] = useState<boolean>(false); // State for saving status
    const [error, setError] = useState<string | null>(null); // State for error messages
    const router = useRouter(); // Initialize router for navigation
    const [isOAuthUser, setIsOAuthUser] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        const auth = getAuth(); // Initialize Firebase Auth
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                // Populate the name and email fields if the user is signed in
                setName(user.displayName || ""); // Use displayName or an empty string
                setEmail(user.email || ""); // Use email or an empty string
                // Check if any provider is NOT password (i.e., OAuth)
                const isOAuth = user.providerData.some(
                    (provider) => provider.providerId !== "password"
                );
                setIsOAuthUser(isOAuth);
            }
        });

        // Cleanup the listener on unmount
        return () => unsubscribe();
    }, []);

    const form = useForm({
        defaultValues: {
            name: name,
            email: email,
            theme: theme,
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });

    useEffect(() => {
        if (name && email && theme) {
            form.reset({
                name,
                email,
                theme,
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            });
        }
    }, [name, email, theme, form]);

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        try {
            const auth = getAuth();
            const user = auth.currentUser;
            const values = form.getValues();

            if (!user) {
                throw new Error("No user is currently signed in.");
            }

            // Update the displayName in Firebase
            if (values.name !== user.displayName) {
                await updateProfile(user, { displayName: values.name });
            }

            // Save theme to Firestore
            const db = getFirestore();
            const userRef = doc(db, "users", user.uid);
            await setDoc(
                userRef,
                { theme: values.theme },
                { merge: true }
            );

            // Change password if not OAuth and fields are filled
            if (
                !isOAuthUser &&
                values.currentPassword &&
                values.newPassword &&
                values.confirmPassword
            ) {
                if (values.newPassword !== values.confirmPassword) {
                    throw new Error("New password and confirmation do not match.");
                }
                // Re-authenticate
                const credential = EmailAuthProvider.credential(
                    user.email!,
                    values.currentPassword
                );
                await reauthenticateWithCredential(user, credential);
                await updatePassword(user, values.newPassword);
                toast.success("Password changed successfully.");
            }

            toast.success("Profile settings saved.");

            // Clear password fields after successful save
            form.reset({
                name: values.name,
                email: values.email,
                theme: values.theme,
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            });

        } catch (err: unknown) {
            console.error("Error saving changes:", err);
            setError(getFriendlyFirebaseErrorMessage(err));
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        router.push("/home"); // Navigate back to the home page
    };

    return (
        <div className="mx-auto max-w-2xl">
            <div>
                <PageHeader
                    title="Settings"
                    subtitle="Your name, how the app looks, and your password."
                />
                <Form {...form}>
                    <form className="space-y-6" onSubmit={handleSave}>
                        <section className="space-y-5 rounded-lg border bg-card p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-100 text-blue-700"><UserRound className="h-5 w-5" /></span><div><h2 className="text-lg font-bold leading-tight">Your account</h2><p className="text-sm text-muted-foreground">This is how we greet you.</p></div></div>
{/* Name Field */}
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="Enter your name"
                                            disabled={isSaving}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Email Field */}
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="Enter your email"
                                            disabled
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        </section>
<section className="space-y-5 rounded-lg border bg-card p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-md bg-violet-100 text-violet-700"><Palette className="h-5 w-5" /></span><div><h2 className="text-lg font-bold leading-tight">Appearance</h2><p className="text-sm text-muted-foreground">Light, dark, or follow your device.</p></div></div>
{/* Theme Field */}
                        <FormField
                            control={form.control}
                            name="theme"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Theme</FormLabel>
                                    <FormControl>
                                        <Select
                                            onValueChange={(value) => {
                                                field.onChange(value);
                                                setTheme(value as ThemeType);
                                            }}
                                            value={field.value}
                                            disabled={isSaving}
                                        >
                                            <SelectTrigger id="theme">
                                                <SelectValue placeholder="Select theme" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="light">Light</SelectItem>
                                                <SelectItem value="dark">Dark</SelectItem>
                                                <SelectItem value="system">System</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        </section>
<section className="space-y-5 rounded-lg border bg-card p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-100 text-amber-700"><KeyRound className="h-5 w-5" /></span><div><h2 className="text-lg font-bold leading-tight">Password</h2><p className="text-sm text-muted-foreground">Leave these empty to keep your current password.</p></div></div>
{isOAuthUser && (
    <p className="flex items-start gap-2 rounded-md border bg-accent/60 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        You signed in with Google, so your password is managed by Google.
    </p>
)}
{/* Password Fields */}
                        <FormField
                            control={form.control}
                            name="currentPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Current Password</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                {...field}
                                                type={showCurrentPassword ? "text" : "password"}
                                                placeholder="Enter your current password"
                                                disabled={isOAuthUser}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrentPassword((v) => !v)}
                                                className="absolute inset-y-0 right-3 flex items-center text-gray-500 dark:text-gray-400"
                                                tabIndex={-1}
                                            >
                                                {showCurrentPassword ? (
                                                    <EyeSlashIcon className="h-5 w-5" />
                                                ) : (
                                                    <EyeIcon className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="newPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>New Password</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                {...field}
                                                type={showNewPassword ? "text" : "password"}
                                                placeholder="Enter your new password"
                                                disabled={isOAuthUser}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword((v) => !v)}
                                                className="absolute inset-y-0 right-3 flex items-center text-gray-500 dark:text-gray-400"
                                                tabIndex={-1}
                                            >
                                                {showNewPassword ? (
                                                    <EyeSlashIcon className="h-5 w-5" />
                                                ) : (
                                                    <EyeIcon className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Confirm Password</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                {...field}
                                                type={showConfirmPassword ? "text" : "password"}
                                                placeholder="Confirm your password"
                                                disabled={isOAuthUser}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword((v) => !v)}
                                                className="absolute inset-y-0 right-3 flex items-center text-gray-500 dark:text-gray-400"
                                                tabIndex={-1}
                                            >
                                                {showConfirmPassword ? (
                                                    <EyeSlashIcon className="h-5 w-5" />
                                                ) : (
                                                    <EyeIcon className="h-5 w-5" />
                                                )}
                                            </button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        </section>
{/* Buttons */}
                        <div className="flex justify-end gap-3">
                            <Button
                                type="submit"
                                disabled={isSaving}
                                className="h-11 w-32"
                            >
                                {isSaving ? "Saving..." : "Save"}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancel}
                                className="h-11 w-32"
                            >
                                Cancel
                            </Button>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
                        )}
                    </form>
                </Form>
            </div>
        </div>
    );
}