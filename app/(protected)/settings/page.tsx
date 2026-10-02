import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { appSettings, db, labels, listings } from "@/lib/db";
import { DEFAULT_CREDIT_SETTINGS } from "@/lib/credit";
import { formatPrice } from "@/lib/format";
import { cardCls, LabelChip } from "@/components/ui";
import { LabelCreateForm, LabelDeleteButton } from "@/components/label-forms";

export default async function SettingsPage() {
  await requireUser();
  const settingsRow = await db.query.appSettings.findFirst({ where: eq(appSettings.id, 1) });
  const settings = settingsRow ?? DEFAULT_CREDIT_SETTINGS;

  const labelRows = await db
    .select({ id: labels.id, name: labels.name, color: labels.color, n: count(listings.id) })
    .from(labels)
    .leftJoin(listings, eq(listings.labelId, labels.id))
    .groupBy(labels.id)
    .orderBy(labels.name);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
      <p className="mt-1 text-sm text-muted">
        Paramètres partagés par tous les utilisateurs : il n’y a pas de réglage individuel.
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold tracking-tight">Paramètres d’emprunt</h2>
        <div className={`${cardCls} mt-3 p-5`}>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-muted">Budget mensuel max</dt>
              <dd className="mt-1 font-mono text-lg font-semibold">
                {settings.monthlyBudget > 0 ? `${formatPrice(settings.monthlyBudget * 100)} / mois` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Apport</dt>
              <dd className="mt-1 font-mono text-lg font-semibold">{formatPrice(settings.downPayment * 100)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Durée souhaitée</dt>
              <dd className="mt-1 font-mono text-lg font-semibold">{settings.durationYears} ans</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted">
            Ajuste-les en direct dans la{" "}
            <Link href="/credit" className="text-accent underline-offset-4 hover:underline">
              page Crédit
            </Link>{" "}
            : les calculs se mettent à jour immédiatement.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Étiquettes</h2>
        <div className={`${cardCls} mt-3 p-5`}>
          <div className="max-w-sm">
            <LabelCreateForm />
          </div>
          {labelRows.length > 0 ? (
            <ul className="mt-5 border-t border-line">
              {labelRows.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-4 border-b border-line/60 py-3 last:border-0">
                  <span>
                    <LabelChip name={l.name} color={l.color} />
                    <span className="ml-3 text-xs text-muted">
                      {l.n} annonce{l.n > 1 ? "s" : ""}
                    </span>
                  </span>
                  <LabelDeleteButton id={l.id} name={l.name} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  );
}
