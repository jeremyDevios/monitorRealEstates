"use client";

import { useState } from "react";
import { useActionState } from "react";
import { addCommentAction, type CommentFormState } from "@/lib/actions/comments";
import { Button, inputCls } from "@/components/ui";

export function CommentForm({ listingId }: { listingId: number }) {
  const [state, formAction, pending] = useActionState(addCommentAction, undefined);
  const [value, setValue] = useState("");

  async function handleSubmit(formData: FormData) {
    const result = (await formAction(formData)) as CommentFormState;
    if (result?.ok) setValue("");
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <input type="hidden" name="listing_id" value={listingId} />
      {state?.error ? <p className="text-sm text-offline">{state.error}</p> : null}
      <textarea
        name="body"
        rows={3}
        className={inputCls}
        placeholder="Ajouter un message…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required
      />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Envoi…" : "Envoyer"}
      </Button>
    </form>
  );
}
