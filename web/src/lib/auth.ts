"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "travel_token";
const USER_KEY = "travel_user";

export interface User {
  id: string;
  phone: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

/**
 * Custom error for API responses, carries HTTP status and optional retry_after.
 */
export class ApiError extends Error {
  status: number;
  retryAfter: number | null;

  constructor(message: string, status: number, retryAfter: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/** Get display name: nickname > masked phone > "用户" */
export function getDisplayName(user: User | null): string {
  if (!user) return "用户";
  if (user.nickname) return user.nickname;
  if (user.phone) return user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
  return "用户";
}

/** Build WeChat login URL (redirects to backend which redirects to WeChat) */
export function getWeChatLoginUrl(platform?: "mp" | ""): string {
  const params = platform ? `?platform=${platform}` : "";
  return `${API_BASE}/api/v1/auth/wechat/login${params}`;
}

/** Detect if running inside WeChat browser */
export function isWeChatBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /micromessenger/i.test(navigator.userAgent);
}

/**
 * Parse an error response into an ApiError with retry_after support.
 */
async function parseErrorResponse(res: Response, fallbackMessage: string): Promise<ApiError> {
  const retryAfter = res.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : null;

  let detail = fallbackMessage;
  try {
    const body = await res.json();
    detail = body.detail || fallbackMessage;
  } catch {
    // body not JSON, use fallback
  }

  return new ApiError(detail, res.status, retryAfterSeconds);
}

export async function sendCode(phone: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/auth/send-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    throw await parseErrorResponse(res, "发送失败");
  }
}

export async function verifyCode(phone: string, code: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
  if (!res.ok) {
    throw await parseErrorResponse(res, "验证失败");
  }
  const data = await res.json();
  setToken(data.token);
  setUser(data.user);
  return data;
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearAuth();
    // Don't hard-redirect mid-render; let AuthGuard handle it on next check
  }
  return res;
}
