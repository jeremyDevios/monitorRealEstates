"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { db, ratings } from "@/lib/db";

export type RatingFormState = { error?: string; ok?: boolean } | undefined;

export async function rateListingAction(
  _prev: RatingFormState,
  formData: FormData,
): Promise<RatingFormState> {
  const user = await requireUser();
  const listingId = Number(formData.get("listing_id"));
  const stars = Number(formData.get("stars"));
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { error: "Note invalide (1 à 5 étoiles)." };
  }
  await db
    .insert(ratings)
    .values({ listingId, userId: user.id, stars })
    .onConflictDoUpdate({
      target: [ratings.listingId, ratings.userId],
      set: { stars, updatedAt: Math.floor(Date.now() / 1000) },
    });
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/listings");
  revalidatePath("/");
  return { ok: true };
}
