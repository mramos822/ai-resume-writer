import { FirebaseError } from "firebase/app";

const errorMessages = {
    'auth/invalid-credential': 'Email and Password do not match our records.',
    'auth/user-not-found': 'No user found with this email.',
    'auth/wrong-password': 'Email and Password do not match our records.',
    'auth/email-already-in-use': 'This email is already in use.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/missing-password': 'Please enter your password.',
    'auth/missing-email': 'Please enter your email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled.',
    'auth/popup-closed-by-user': 'The sign-in window was closed before finishing.',
    'auth/requires-recent-login': 'Please log in again to continue.',
    'An error occurred. Please try again.': 'Check your email and password and try again.',
};

export function getFriendlyFirebaseErrorMessage(err: unknown): string {
    if (err instanceof FirebaseError) {
        // Prefer the code property if available
        if (err.code && err.code in errorMessages) {
            return errorMessages[err.code as keyof typeof errorMessages];
        }
        // Fallback: Extract the key between parentheses in the message
        const match = err.message.match(/\(([^)]+)\)/);
        const errorKey = match ? match[1] : null;
        if (errorKey && errorKey in errorMessages) {
            return errorMessages[errorKey as keyof typeof errorMessages];
        }
        return "Something went wrong. Please try again.";
    }
    // Fallback for non-Firebase errors
    return "An unexpected error occurred. Please try again.";
}