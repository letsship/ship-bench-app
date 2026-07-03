import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { resolveStudio } from "@/lib/services/context";
import { signOut } from "./actions";
import { Sidebar } from "./_components/sidebar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { ctx } = await resolveStudio();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8 md:flex-row">
      <aside className="w-full shrink-0 md:w-56">
        <div className="text-lg font-semibold">Studiobook</div>
        <div className="text-xs text-[var(--color-muted)]">{ctx.studio.name}</div>
        <div className="mt-6">
          <Sidebar />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between pb-6">
          <span className="text-sm text-[var(--color-muted)]">{session.email}</span>
          <form action={signOut}>
            <button type="submit" className="sb-btn">
              Sign out
            </button>
          </form>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
