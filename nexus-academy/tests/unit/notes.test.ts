import { describe, expect, it } from "vitest";
import { notesToMarkdown } from "@/lib/notes";

const fmt = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

describe("notesToMarkdown", () => {
  it("agrupa por curso y conserva el texto de cada nota", () => {
    const md = notesToMarkdown(
      [
        { body: "git add antes de commit\n- paso 2", updated_at: "2026-11-20T10:00:00Z", lesson_title: "Commits y el historial", course_title: "Git y GitHub" },
        { body: "ramas = trabajo en paralelo", updated_at: "2026-11-21T10:00:00Z", lesson_title: "Ramas", course_title: "Git y GitHub" },
        { body: "usar const", updated_at: "2026-11-22T10:00:00Z", lesson_title: "Variables", course_title: "JavaScript" },
      ],
      new Date("2026-11-23T00:00:00Z"),
      fmt,
    );
    expect(md.match(/^## /gm)).toHaveLength(2);
    expect(md.match(/^### /gm)).toHaveLength(3);
    expect(md).toContain("git add antes de commit\n- paso 2");
    expect(md).toContain("Exportado el 2026-11-23.");
  });

  it("escapa títulos que podrían romper el Markdown", () => {
    const md = notesToMarkdown([{ body: "x", updated_at: "2026-11-20T10:00:00Z", lesson_title: "# *Título* [raro]", course_title: null }], new Date(), fmt);
    expect(md).toContain("### \\# \\*Título\\* \\[raro\\]");
    expect(md).toContain("## Curso no disponible");
  });

  it("explica cuando no hay notas", () => {
    expect(notesToMarkdown([], new Date(), fmt)).toContain("Todavía no tienes notas.");
  });
});
