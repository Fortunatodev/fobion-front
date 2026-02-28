const TOKEN_KEY = "forbion_token";

export function saveToken(token: string): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, token);
    }
  } catch (err) {
    console.error("[auth] Erro ao salvar token:", err);
  }
}

export function getToken(): string | null {
  try {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function removeToken(): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    console.error("[auth] Erro ao remover token:", err);
  }
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}
