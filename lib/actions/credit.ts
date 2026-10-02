"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { appSettings, db, rates } from "@/lib/db";
import { parseIntInput, parseNumInput } from "@/lib/forms";
import { refreshMarketRates } from "@/lib/rates/refresh";

export type CreditFormState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

// ---- paramètres d'emprunt communs (une seule ligne, id = 1) -----------------

export async function saveSettingsAction(
  _prev: CreditFormState,
  formData: FormData,
): Promise<CreditFormState> {
  await requireUser();
  const monthlyBudget = parseIntInput(formData.get("monthly_budget")) ?? 0;
  const downPayment = parseIntInput(formData.get("down_payment")) ?? 0;
  const durationYears = parseIntInput(formData.get("duration_years")) ?? 20;

  const fieldErrors: Record<string, string> = {};
  if (monthlyBudget < 0 || monthlyBudget > 50_000)
    fieldErrors.monthly_budget = "Budget mensuel invalide.";
  if (downPayment < 0 || downPayment > 10_000_000) fieldErrors.down_payment = "Apport invalide.";
  if (durationYears < 5 || durationYears > 35) fieldErrors.duration_years = "Durée entre 5 et 35 ans.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  await db
    .insert(appSettings)
    .values({ id: 1, monthlyBudget, downPayment, durationYears })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: {
        monthlyBudget,
        downPayment,
        durationYears,
        updatedAt: Math.floor(Date.now() / 1000),
      },
    });
  revalidatePath("/");
  revalidatePath("/credit");
  revalidatePath("/settings");
  return { ok: true };
}

// ---- taux de crédit ---------------------------------------------------------

export type RefreshRatesState = { ok?: boolean; message?: string; error?: string } | undefined;

export async function refreshRatesAction(): Promise<RefreshRatesState> {
  await requireUser();
  const result = await refreshMarketRates({ force: true });
  if (result.fetched) {
    revalidatePath("/");
    revalidatePath("/credit");
    const banksPart =
      result.banks > 0
        ? ` + ${result.banks} taux par banque relevés sur MoneyVox.`
        : result.banksError
          ? ` — baromètre des banques indisponible (${result.banksError}).`
          : " — aucune banque relevée.";
    return {
      ok: true,
      message: `Taux actualisés : marché ${String(result.rate).replace(".", ",")} % (${result.date})${banksPart}`,
    };
  }
  return { error: `Actualisation impossible : ${result.error ?? "erreur inconnue"}.` };
}

export async function addRateAction(
  _prev: CreditFormState,
  formData: FormData,
): Promise<CreditFormState> {
  await requireUser();
  const bank = String(formData.get("bank") ?? "").trim();
  const parsedRate = parseNumInput(formData.get("rate"));
  const parsedDuration = parseIntInput(formData.get("duration_years"));
  const fieldErrors: Record<string, string> = {};
  if (!bank) fieldErrors.bank = "Organisme requis.";
  if (bank.length > 60) fieldErrors.bank = "Nom trop long (60 caractères max).";
  if (parsedRate == null || parsedRate < 0.01 || parsedRate > 15)
    fieldErrors.rate = "Taux invalide (entre 0,01 et 15 %).";
  if (parsedDuration != null && (parsedDuration < 5 || parsedDuration > 35))
    fieldErrors.duration_years = "Durée invalide (entre 5 et 35 ans).";
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  if (parsedRate == null) return { error: "Taux invalide." };

  await db
    .insert(rates)
    .values({ bank, rate: parsedRate, durationYears: parsedDuration, source: "manual" });
  revalidatePath("/");
  revalidatePath("/credit");
  return { ok: true };
}

export async function deleteRateAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = Number(formData.get("rate_id"));
  await db.delete(rates).where(eq(rates.id, id));
  revalidatePath("/");
  revalidatePath("/credit");
}
