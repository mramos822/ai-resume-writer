"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { useT } from "@/i18n/provider";

// Define schema for form validation
const resetPasswordSchema = z.object({
    email: z.string().email("Invalid email address").nonempty("Email is required"),
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm({
    onSuccess,
    buttonText = "Reset password",
}: {
    onSuccess: () => void;
    buttonText?: string;
    inputSpacing?: string;
}) {
  const { tr } = useT();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const form = useForm<ResetPasswordFormValues>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: {
            email: "",
        },
    });

    const handlePasswordReset = async (values: ResetPasswordFormValues) => {
        setIsSubmitting(true);
        try {
            await sendPasswordResetEmail(auth, values.email);
            toast.success(tr("Password reset email sent. Please check your inbox."));
            onSuccess(); // Notify parent of success
        } catch (error: unknown) {
            toast.error(tr("Failed to send password reset email. Please try again."));
            console.error("Password reset error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(handlePasswordReset)}
                className="space-y-4 w-full"
            >
                <FormField
                    name="email"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{tr("Email")}</FormLabel>
                            <FormControl>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder={tr("Enter your email")}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? tr("Sending...") : buttonText}
                </Button>
            </form>
        </Form>
    );
}