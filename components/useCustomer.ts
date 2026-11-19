"use client";

import { useEffect, useState } from "react";
import { isDemo } from "@/lib/config";
import { browserClient } from "@/lib/supabase/browser";

/** Sesión de la clienta, leída en el navegador (las páginas de la tienda se cachean sin cookies). */
export function useCustomer() {
  const [state, setState] = useState<{ loggedIn: boolean; email: string; ready: boolean }>({
    loggedIn: false,
    email: "",
    ready: false,
  });
  useEffect(() => {
    if (isDemo) {
      setState((s) => ({ ...s, ready: true }));
      return;
    }
    const sb = browserClient();
    sb.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setState({ loggedIn: Boolean(u), email: u?.email ?? "", ready: true });
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setState({ loggedIn: Boolean(session?.user), email: session?.user?.email ?? "", ready: true });
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}
