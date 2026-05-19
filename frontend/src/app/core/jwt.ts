export interface JwtClaims {
  exp?: number;
  iat?: number;
  user_id?: number;
  tenant_id?: number;
  tenant_code?: string;
  department_id?: number | null;
  department_key?: string;
  email?: string;
}

export function decodeJwt(token: string | null): JwtClaims | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

export function isExpired(claims: JwtClaims | null, skewSeconds = 5): boolean {
  if (!claims?.exp) return true;
  return Date.now() / 1000 >= claims.exp - skewSeconds;
}
