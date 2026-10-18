// src/lib/authFetch.ts
// fetch() that automatically sends the signed-in user's Firebase ID token.
import { auth } from "@/lib/firebase";

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
