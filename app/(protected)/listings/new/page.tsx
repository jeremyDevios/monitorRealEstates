import { db, labels } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { AddUrlForm } from "@/components/add-url-form";
import { ManualForm } from "@/components/manual-form";

export default async function NewListingPage() {
  await requireUser();
  const allLabels = await db.select({ id: labels.id, name: labels.name }).from(labels);
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">Ajouter une annonce</h1>
      <p className="mt-1 text-sm text-muted">
        Le serveur archive tout en local : photos, description, prix, surfaces.
      </p>

      <section className="mt-6 border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold tracking-tight">Depuis une URL Leboncoin</h2>
        <div className="mt-4">
          <AddUrlForm />
        </div>
      </section>

      <section className="mt-8 border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold tracking-tight">
          Saisie manuelle
          <span className="ml-2 font-normal text-muted">si la récupération automatique échoue</span>
        </h2>
        <div className="mt-4">
          <ManualForm labels={allLabels} />
        </div>
      </section>
    </div>
  );
}
