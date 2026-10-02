import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/login-form";
import { HouseMark } from "@/components/ui";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8">
        <div className="flex items-center gap-3">
          <HouseMark />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Suivi immobilier</h1>
            <p className="text-xs text-muted">Le carnet partagé des annonces Leboncoin.</p>
          </div>
        </div>
        <div className="mt-7">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
