"use client";
import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { submitReviewAction } from "@/lib/actions/learning";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function ReviewForm({ courseId, slug, initial }: { courseId: string; slug: string; initial?: { rating: number; comment: string | null } | null }) {
  const [state, action] = useActionState(submitReviewAction.bind(null, courseId, slug), null);
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  return (
    <form action={action} className="glass space-y-4 rounded-2xl p-5">
      <p className="font-medium text-white">{initial ? "Edita tu reseña" : "Comparte tu opinión"}</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Calificación">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={rating === i}
            aria-label={`${i} estrella${i > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(i)}
            className="grid size-10 place-items-center rounded-lg hover:bg-white/[0.05]"
          >
            <Star className={cn("size-6", (hover || rating) >= i ? "fill-amber-400 text-amber-400" : "text-white/25")} />
          </button>
        ))}
      </div>
      <input type="hidden" name="rating" value={rating} />
      <label htmlFor="review-comment" className="sr-only">Comentario</label>
      <Textarea id="review-comment" name="comment" maxLength={2000} defaultValue={initial?.comment ?? ""} placeholder="¿Qué te pareció el curso? (opcional)" />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Guardando…">{initial ? "Actualizar reseña" : "Publicar reseña"}</SubmitButton>
    </form>
  );
}
