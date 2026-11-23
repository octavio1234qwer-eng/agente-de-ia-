#!/usr/bin/env node
// Genera supabase/seed.sql a partir de supabase/seed/catalog.mjs.
// Uso: npm run seed:generate
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { categories, instructors, courses, bundles } from "../supabase/seed/catalog.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// UUID determinista (v5-like) para que el seed sea reproducible.
function uuid(name) {
  const h = createHash("sha1").update(`nexus-academy:${name}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// Cadena SQL segura usando dollar-quoting con etiqueta que no aparece en el texto.
function q(value) {
  if (value === null || value === undefined) return "null";
  const text = String(value);
  let tag = "s";
  while (text.includes(`$${tag}$`)) tag += "x";
  return `$${tag}$${text}$${tag}$`;
}
const arr = (items) => `array[${(items ?? []).map(q).join(", ")}]::text[]`;
const num = (n) => (n === null || n === undefined ? "null" : String(Number(n)));

const out = [];
out.push("-- ARCHIVO GENERADO por scripts/generate-seed.mjs. No editar a mano.");
out.push("-- Catálogo inicial de NEXUS ACADEMY (sin reseñas, ventas ni alumnos ficticios).");
out.push("begin;");

categories.forEach((c, i) => {
  out.push(
    `insert into public.categories (id, slug, name, description, icon, color, sort_order) values (${q(uuid(`cat:${c.slug}`))}, ${q(c.slug)}, ${q(c.name)}, ${q(c.description)}, ${q(c.icon)}, ${q(c.color)}, ${i}) on conflict (slug) do nothing;`,
  );
});

instructors.forEach((ins) => {
  out.push(
    `insert into public.instructors (id, slug, name, headline, bio) values (${q(uuid(`ins:${ins.slug}`))}, ${q(ins.slug)}, ${q(ins.name)}, ${q(ins.headline)}, ${q(ins.bio)}) on conflict (slug) do nothing;`,
  );
});

for (const c of courses) {
  const courseId = uuid(`course:${c.slug}`);
  out.push(
    `insert into public.courses (id, slug, title, subtitle, description, category_id, instructor_id, level, price_cents, compare_at_price_cents, currency, status, is_featured, what_you_will_learn, requirements, target_audience) values (` +
      [
        q(courseId),
        q(c.slug),
        q(c.title),
        q(c.subtitle),
        q(c.description),
        q(uuid(`cat:${c.category}`)),
        q(uuid(`ins:${c.instructor}`)),
        q(c.level),
        num(c.price),
        num(c.compareAt ?? null),
        q("MXN"),
        q("published"),
        c.featured ? "true" : "false",
        arr(c.learn),
        arr(c.requirements),
        arr(c.audience),
      ].join(", ") +
      ") on conflict (slug) do nothing;",
  );

  c.modules.forEach((m, mi) => {
    const moduleId = uuid(`module:${c.slug}:${mi}`);
    out.push(
      `insert into public.modules (id, course_id, title, position) values (${q(moduleId)}, ${q(courseId)}, ${q(m.title)}, ${mi}) on conflict (id) do nothing;`,
    );
    m.lessons.forEach((l, li) => {
      const lessonId = uuid(`lesson:${c.slug}:${mi}:${li}`);
      out.push(
        `insert into public.lessons (id, module_id, course_id, title, type, duration_seconds, position, is_preview) values (${q(lessonId)}, ${q(moduleId)}, ${q(courseId)}, ${q(l.title)}, ${q(l.type)}, ${num(l.duration ?? 0)}, ${li}, ${l.preview ? "true" : "false"}) on conflict (id) do nothing;`,
      );
      if (l.body) {
        out.push(
          `insert into public.lesson_contents (lesson_id, course_id, body) values (${q(lessonId)}, ${q(courseId)}, ${q(l.body)}) on conflict (lesson_id) do update set body = excluded.body;`,
        );
      }
      (l.questions ?? []).forEach((question, qi) => {
        out.push(
          `insert into public.quiz_questions (id, lesson_id, course_id, prompt, options, correct_index, explanation, position) values (${q(uuid(`quiz:${c.slug}:${mi}:${li}:${qi}`))}, ${q(lessonId)}, ${q(courseId)}, ${q(question.prompt)}, ${q(JSON.stringify(question.options))}::jsonb, ${num(question.correct)}, ${q(question.explanation)}, ${qi}) on conflict (id) do nothing;`,
        );
      });
    });
  });
}

for (const b of bundles) {
  const bundleId = uuid(`bundle:${b.slug}`);
  out.push(
    `insert into public.bundles (id, slug, title, description, price_cents, compare_at_price_cents, currency, status) values (${q(bundleId)}, ${q(b.slug)}, ${q(b.title)}, ${q(b.description)}, ${num(b.price)}, ${num(b.compareAt)}, 'MXN', 'published') on conflict (slug) do nothing;`,
  );
  b.courses.forEach((slug, i) => {
    out.push(
      `insert into public.bundle_courses (bundle_id, course_id, position) values (${q(bundleId)}, ${q(uuid(`course:${slug}`))}, ${i}) on conflict do nothing;`,
    );
  });
}

out.push("commit;");
writeFileSync(join(root, "supabase", "seed.sql"), out.join("\n") + "\n");
console.log(`seed.sql generado: ${categories.length} categorías, ${courses.length} cursos, ${bundles.length} paquetes.`);
