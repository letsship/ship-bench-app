import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "../env";

// Service-role client: full read/write access, no session persistence. All of
// Studiobook's data access runs server-side through this client (via the
// repositories) — the app's auth is a separate dev-cookie stub, not Supabase
// Auth.
export const createServiceClient = () => {
  const env = serverEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};
