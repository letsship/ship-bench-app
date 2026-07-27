import Link from "next/link";
import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth/session";

// Magic-link STUB: there is no email round-trip. Submitting "signs you in" by
// minting the dev session cookie for the entered email (or a default operator).
async function signIn(formData: FormData): Promise<void> {
  "use server";
  const email = String(formData.get("email") ?? "").trim() || "operator@riverbank.studio";
  const next = String(formData.get("next") ?? "/dashboard");
  await startSession(email);
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const { next } = searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="text-lg font-semibold">
        Studiobook
      </Link>
      <div className="sb-card mt-6 p-8">
        <h1 className="text-2xl">Sign in to your studio</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Enter your email and we&rsquo;ll send you a magic link. (This demo signs you straight in.)
        </p>
        <form action={signIn} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next ?? "/dashboard"} />
          <div>
            <label className="sb-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="sb-input"
              placeholder="operator@riverbank.studio"
              autoComplete="email"
            />
          </div>
          <button type="submit" className="sb-btn sb-btn-primary w-full">
            Send magic link
          </button>
        </form>
      </div>
    </main>
  );
}
