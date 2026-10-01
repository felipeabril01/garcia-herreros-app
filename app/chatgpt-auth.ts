import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";
const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";
const ACCESS_LOGOUT_PATH = "/cdn-cgi/access/logout";

function decodeJwtSubject(token: string | null): string | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const email = requestHeaders.get(ACCESS_EMAIL_HEADER)?.trim().toLowerCase() ?? null;
  if (!email) return null;

  const userId =
    decodeJwtSubject(requestHeaders.get(ACCESS_JWT_HEADER)) ??
    `access:${email}`;

  return {
    userId,
    displayName: email,
    email,
    fullName: null,
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  // Cloudflare Access handles sign-in before the request reaches the Worker.
  redirect("/");
}

export function chatGPTSignInPath(_returnTo: string): string {
  return "/";
}

export function chatGPTSignOutPath(_returnTo = "/"): string {
  return ACCESS_LOGOUT_PATH;
}
