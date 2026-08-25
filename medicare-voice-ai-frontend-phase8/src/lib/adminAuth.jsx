import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as adminApi from "./adminApi";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAdmin = useCallback(async () => {
    if (!adminApi.getAdminToken()) {
      setAdmin(null);
      setLoading(false);
      return;
    }
    try {
      const me = await adminApi.adminMe();
      setAdmin(me);
    } catch {
      adminApi.setAdminToken(null);
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  async function signIn(email, password) {
    await adminApi.adminLogin(email, password);
    await loadAdmin();
  }

  function signOut() {
    adminApi.adminLogout();
    setAdmin(null);
  }

  return (
    <AdminAuthContext.Provider value={{ admin, loading, signIn, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
