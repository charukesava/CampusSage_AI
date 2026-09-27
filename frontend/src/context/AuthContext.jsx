import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiClient, getApiError } from "../services/api";

const AuthContext = createContext(null);
const TOKEN_KEY = "campussage-token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    apiClient.get("/auth/me")
      .then(({ data }) => setUser(data.user))
      .catch(() => {
        window.localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  async function login(credentials) {
    try {
      const { data } = await apiClient.post("/auth/login", credentials);
      window.localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (error) {
      throw new Error(getApiError(error));
    }
  }

  async function register(credentials) {
    try {
      const { data } = await apiClient.post("/auth/register", credentials);
      window.localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (error) {
      throw new Error(getApiError(error));
    }
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  const value = useMemo(() => ({
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    logout,
  }), [user, token, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
