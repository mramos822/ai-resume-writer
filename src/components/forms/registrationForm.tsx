"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getFriendlyFirebaseErrorMessage } from "@/utils/firebaseErrorHandler";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner"; // Import Sonner's toast function
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth"; // Import GoogleAuthProvider
import { FcGoogle } from "react-icons/fc"; // Import Google icon for the button
import { useT } from "@/i18n/provider";

interface RegistrationFormValues {
    email: string;
    password: string;
    confirmPassword: string;
}

export function RegistrationForm({ onRegister }: { onRegister: () => void }) {
  const { tr } = useT();
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    // nobody under 16 may register: the person confirms their age and the terms before an account is made
    const [agreed, setAgreed] = useState(false);
    const needAgree = () => {
        setError(tr("Please confirm that you are 16 or older and accept the terms to continue."));
    };

    const form = useForm<RegistrationFormValues>({
        defaultValues: {
            email: "",
            password: "",
            confirmPassword: "",
        },
    });

    const handleGoogleSignIn = async () => {
        if (!agreed) return needAgree();
        try {
            const provider = new GoogleAuthProvider(); // Initialize GoogleAuthProvider
            const result = await signInWithPopup(auth, provider); // Sign in with Google popup

            onRegister(); // Notify the parent component
        } catch (err: unknown) {
            toast.error(tr("Failed to sign in with Google. Please try again."));
            console.error("Google sign-in error:", err);
        }
    };

    const handleRegister = async (values: RegistrationFormValues) => {
        setError(null);
        if (!agreed) return needAgree();

        if (values.password !== values.confirmPassword) {
            setError(tr("Passwords do not match."));
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
            const user = userCredential.user;

            // Send email verification
            await sendEmailVerification(user);

            // Show toast notification
            toast.success(tr("Verification email sent! Please check your inbox and verify your email before logging in."));

            onRegister(); // Notify the parent component to switch to the login form
        } catch (err: unknown) {
            setError(getFriendlyFirebaseErrorMessage(err));
        }
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(handleRegister)}
                className="space-y-4 w-full"
            >
                {error && <p className="text-sm text-red-500">{error}</p>}

                <FormField
                    name="email"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{tr("Email")}</FormLabel>
                            <FormControl>
                                <Input
                                    id="email"
                                    placeholder={tr("Enter your email")}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    name="password"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{tr("Password")}</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder={tr("Enter your password")}
                                        {...field}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-3 flex items-center text-gray-500 dark:text-gray-400"
                                    >
                                        {showPassword ? (
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
                    name="confirmPassword"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{tr("Confirm Password")}</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder={tr("Confirm your password")}
                                        {...field}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-3 flex items-center text-gray-500 dark:text-gray-400"
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

                <label className="flex items-start gap-2.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" />
                    <span>{tr("I am 16 or older, and I accept the")}{" "}<Link href="/terms" target="_blank" className="underline">{tr("Terms of Service")}</Link>{" "}{tr("and the")}{" "}
                        <Link href="/privacy" target="_blank" className="underline">{tr("Privacy Policy")}</Link>.
                    </span>
                </label>

                <Button type="submit" className="w-full">{tr("Register")}</Button>

                {/* Divider with "or" */}
                <div className="flex items-center my-4">
                    <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                    <span className="mx-2 text-sm text-gray-500 dark:text-gray-400">{tr("or")}</span>
                    <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                </div>

                {/* Google Sign-In Button */}
                <Button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="w-full flex items-center justify-center gap-2 dark:bg-black dark:text-stone-300 dark:border-stone-600 border-1 bg-white text-black border-black"
                >
                    <FcGoogle className="h-5 w-5" /> {/* Google Icon */}{tr("Continue with Google")}</Button>
            </form>
        </Form>
    );
}