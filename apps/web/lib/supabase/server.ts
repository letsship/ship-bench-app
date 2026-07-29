import type { CookieOptions } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv } from "../env";

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

// Cookie-aware server client (the idiomatic @supabase/ssr scaffold). Studiobook
// itself authenticates with a dev-cookie stub rather than Supabase Auth, so this
// factory is provided for completeness and for code that wants a request-scoped
// Supabase client.
export const createClient = async (
  cookieStore?: Awaited<ReturnType<typeof cookies>>,
) => {
  const store = cookieStore ?? (await cookies());
  const env = clientEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              store.set(name, value, options);
            }
          } catch {
            // Cookies can only be modified in a Route Handler or Server Action;
            // during server-component rendering this fails silently.
          }
        },
      },
    },
  );
};
