import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "../env";

// Browser client (the idiomatic @supabase/ssr scaffold). Not used by the app's
// pages today — data flows through the server-side repositories — but provided
// for completeness.
export const createClient = () => {
  const env = clientEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
};
