"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { db, labels } from "@/lib/db";

export type LabelFormState = { error?: string } | undefined;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export async function createLabelAction(
  _prev: LabelFormState,
  formData: FormData,
): Promise<LabelFormState> {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  if (!name) return { error: "Nom requis." };
  if (name.length > 40) return { error: "Nom trop long (40 caractères max)." };
  if (!HEX_RE.test(color)) return { error: "Couleur invalide." };
  const existing = await db.select({ id: labels.id }).from(labels).where(eq(labels.name, name));
  if (existing.length) return { error: `L'étiquette « ${name} » existe déjà.` };
  await db.insert(labels).values({ name, color });
  revalidatePath("/settings");
  revalidatePath("/listings");
  revalidatePath("/");
  return {};
}

export async function deleteLabelAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = Number(formData.get("label_id"));
  await db.delete(labels).where(eq(labels.id, id));
  revalidatePath("/settings");
  revalidatePath("/listings");
  revalidatePath("/");
}
