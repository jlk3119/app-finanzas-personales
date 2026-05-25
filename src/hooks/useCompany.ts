"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import type { Company } from "@/types";

type UseCompanyReturn = {
  companyId: string | null;
  role: "owner" | "employee" | null;
  company: Company | null;
  loading: boolean;
  refresh: () => void;
};

const CACHE_KEY = "minegocio_company";

type CachedCompany = { companyId: string; role: "owner" | "employee" };

export function useCompany(): UseCompanyReturn {
  const supabase = createClient();

  const readCache = (): CachedCompany | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as CachedCompany) : null;
    } catch {
      return null;
    }
  };

  const cached = readCache();
  const [companyId, setCompanyId] = useState<string | null>(cached?.companyId ?? null);
  const [role, setRole] = useState<"owner" | "employee" | null>(cached?.role ?? null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(!cached);

  const fetchCompany = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("company_members")
      .select("role, companies(*)")
      .limit(1)
      .maybeSingle();

    if (data?.companies) {
      const co = data.companies as unknown as Company;
      const r = data.role as "owner" | "employee";
      setCompanyId(co.id);
      setRole(r);
      setCompany(co);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ companyId: co.id, role: r }));
      } catch { /* ignore storage errors */ }
    } else {
      setCompanyId(null);
      setRole(null);
      setCompany(null);
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCompany();
  }, [fetchCompany]);

  return { companyId, role, company, loading, refresh: fetchCompany };
}
