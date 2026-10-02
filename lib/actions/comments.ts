"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { comments, db } from "@/lib/db";

export type CommentFormState = { error?: string; ok?: boolean } | undefined;

export async function addCommentAction(
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const user = await requireUser();
  const listingId = Number(formData.get("listing_id"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Le message est vide." };
  if (body.length > 5000) return { error: "Message trop long (5 000 caractères max)." };
  await db.insert(comments).values({ listingId, userId: user.id, body });
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/listings");
  revalidatePath("/");
  return { ok: true };
}
