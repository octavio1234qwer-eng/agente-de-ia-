import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { CourseForm } from "@/components/admin/course-form";

export const metadata: Metadata = { title: "Nuevo curso" };

export default async function NewCourse() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: categories }, { data: instructors }] = await Promise.all([
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("instructors").select("id, name").order("name"),
  ]);
  return (
    <>
      <AdminHeader title="Nuevo curso" description="Después de crearlo podrás armar el temario y subir videos." />
      <Panel><CourseForm categories={categories ?? []} instructors={instructors ?? []} /></Panel>
    </>
  );
}
