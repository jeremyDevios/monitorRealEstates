import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth/session";
import { btnPrimaryCls, HouseMark } from "@/components/ui";

const NAV = [
  { href: "/", label: "Résumé" },
  { href: "/listings", label: "Annonces" },
  { href: "/credit", label: "Crédit" },
  { href: "/settings", label: "Configuration" },
];

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <HouseMark />
              <span className="hidden sm:inline">Suivi immobilier</span>
            </Link>
            <nav className="flex gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/listings/new" className={`${btnPrimaryCls} px-3 py-1.5`}>
              Ajouter une annonce
            </Link>
            <span className="hidden text-sm text-muted md:inline">{user.username}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg px-2 py-1.5 text-sm text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                Sortir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8">{children}</main>
    </>
  );
}
