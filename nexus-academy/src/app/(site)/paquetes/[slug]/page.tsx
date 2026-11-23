import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { COURSE_CARD_SELECT, type CourseCard as CourseCardData } from "@/lib/data/catalog";
import { CourseCard } from "@/components/course/course-card";
import { PriceTag } from "@/components/course/price-tag";
import { PurchaseActions } from "@/components/course/purchase-actions";

type Params = { slug: string };

async function getBundle(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bundles")
    .select(`*, bundle_courses(position, course:courses(${COURSE_CARD_SELECT}))`)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const bundle = await getBundle((await params).slug);
  if (!bundle) notFound();
  return { title: bundle.title, description: bundle.description };
}

export default async function BundlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const bundle = await getBundle(slug);
  if (!bundle) notFound();
  const user = await getCurrentUser();
  const supabase = await createClient();
  const courses = [...bundle.bundle_courses].sort((a, b) => a.position - b.position).map((bc) => bc.course as unknown as CourseCardData).filter(Boolean);
  const [owned, inCart] = await Promise.all([
    user ? supabase.from("enrollments").select("course_id").eq("user_id", user.id).is("revoked_at", null) : Promise.resolve({ data: [] }),
    user ? supabase.from("cart_items").select("id").eq("user_id", user.id).eq("bundle_id", bundle.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const ownedIds = new Set((owned.data ?? []).map((e) => e.course_id));
  const ownsAll = courses.length > 0 && courses.every((c) => ownedIds.has(c.id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-electric-500/30 to-violet-600/30 text-violet-200"><Layers className="size-6" /></span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">{bundle.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-mist-300">{bundle.description}</p>
          <h2 className="mt-10 text-xl font-semibold text-white">Incluye {courses.length} cursos</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {courses.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        </div>
        <aside className="glass-strong glow-border h-fit space-y-5 rounded-3xl p-6 lg:sticky lg:top-24">
          <PriceTag price={bundle.price_cents} compareAt={bundle.compare_at_price_cents} currency={bundle.currency} size="lg" />
          {ownsAll ? (
            <p className="text-sm text-emerald-300">Ya tienes todos los cursos de este paquete.</p>
          ) : (
            <PurchaseActions itemType="bundle" courseId={bundle.id} slug={bundle.slug} isFree={false} enrolled={false} inCart={Boolean(inCart.data)} favorite={false} signedIn={Boolean(user)} />
          )}
          <p className="text-xs text-mist-400">Acceso de por vida a todos los cursos incluidos y certificado por cada curso completado.</p>
        </aside>
      </div>
    </div>
  );
}
