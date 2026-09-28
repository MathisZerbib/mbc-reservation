type TokenPayload = {
  userId?: string;
  isDemo?: boolean;
  [key: string]: unknown;
};

export function getTokenPayload(): TokenPayload | null {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload)) as TokenPayload;
  } catch {
    return null;
  }
}

// Client-side hint only (the backend re-verifies the token on every request).
export function isDemoSession(): boolean {
  return getTokenPayload()?.isDemo === true;
}
