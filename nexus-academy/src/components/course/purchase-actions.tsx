"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Heart, LoaderCircle, ShoppingCart } from "lucide-react";
import { addToCartAction } from "@/lib/actions/commerce";
import { enrollFreeAction, toggleFavoriteAction } from "@/lib/actions/learning";
import { Button, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  courseId: string;
  slug: string;
  isFree: boolean;
  enrolled: boolean;
  inCart: boolean;
  favorite: boolean;
  signedIn: boolean;
  itemType?: "course" | "bundle";
};

export function PurchaseActions({ courseId, slug, isFree, enrolled, inCart, favorite: initialFavorite, signedIn, itemType = "course" }: Props) {
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [favorite, setFavorite] = useState(initialFavorite);
  const path = itemType === "course" ? `/cursos/${slug}` : `/paquetes/${slug}`;

  const run = (key: string, fn: () => Promise<{ error?: string; success?: string } | void | undefined>) => {
    setWhich(key);
    setMessage(null);
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) setMessage({ kind: "error", text: res.error });
      else if (res && "success" in res && res.success) setMessage({ kind: "ok", text: res.success });
    });
  };

  if (enrolled && itemType === "course") {
    return (
      <div className="space-y-3">
        <Link href={`/aprender/${slug}`} className={buttonClasses("primary", "lg", "w-full")}>Continuar aprendiendo</Link>
        <p className="text-center text-xs text-mist-400">Ya tienes acceso a este curso.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isFree && itemType === "course" ? (
        <Button size="lg" className="w-full" disabled={pending} onClick={() => run("enroll", () => enrollFreeAction(courseId, slug))}>
          {pending && which === "enroll" && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          Inscribirme gratis
        </Button>
      ) : (
        <>
          <Button size="lg" className="w-full" disabled={pending} onClick={() => run("buy", () => addToCartAction(itemType, courseId, path, true))}>
            {pending && which === "buy" && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            Comprar ahora
          </Button>
          {inCart ? (
            <Link href="/carrito" className={buttonClasses("secondary", "lg", "w-full")}>
              <ShoppingCart className="size-4" aria-hidden /> Ir al carrito
            </Link>
          ) : (
            <Button size="lg" variant="secondary" className="w-full" disabled={pending} onClick={() => run("cart", () => addToCartAction(itemType, courseId, path))}>
              {pending && which === "cart" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ShoppingCart className="size-4" aria-hidden />}
              Añadir al carrito
            </Button>
          )}
        </>
      )}
      {itemType === "course" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run("fav", async () => {
              const res = await toggleFavoriteAction(courseId, path);
              setFavorite(res.favorite);
              return { success: res.favorite ? "Guardado en favoritos." : "Quitado de favoritos." };
            })
          }
          className={cn("flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm transition", favorite ? "text-pink-300" : "text-mist-300 hover:text-white")}
          aria-pressed={favorite}
        >
          <Heart className={cn("size-4", favorite && "fill-pink-400 text-pink-400")} aria-hidden />
          {favorite ? "En tus favoritos" : signedIn ? "Guardar en favoritos" : "Inicia sesión para guardar"}
        </button>
      )}
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={cn("text-center text-sm", message.kind === "error" ? "text-red-300" : "text-emerald-300")}>
          {message.text}
        </p>
      )}
    </div>
  );
}
