// Who runs Kaizo: the emails in ADMIN_EMAILS (comma separated, in the server's environment). They can read the contact messages.
// The email must be verified by the sign-in provider, so nobody can claim an admin address by typing it.
export function adminEmails(env: string | undefined = process.env.ADMIN_EMAILS): string[] {
  return (env || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdmin(user: { email?: string; email_verified?: boolean }, env: string | undefined = process.env.ADMIN_EMAILS): boolean {
  const email = (user.email || "").toLowerCase();
  return !!email && user.email_verified === true && adminEmails(env).includes(email);
}
