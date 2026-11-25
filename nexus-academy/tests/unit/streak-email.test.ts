import { describe, expect, it } from "vitest";
import { streakReminderEmail } from "@/lib/email/templates";

const base = { siteUrl: "https://nexus.example", unsubscribe: "https://nexus.example/baja?t=abc" };

describe("streakReminderEmail", () => {
  it("usa el nombre de pila, la racha real y el curso para continuar", () => {
    const e = streakReminderEmail({ ...base, name: "Ana López", streak: 4, courseTitle: "Git y GitHub", courseSlug: "git-github-esencial" });
    expect(e.subject).toBe("Tu racha de 4 días sigue viva hoy");
    expect(e.html).toContain("Ana, no pierdas tu racha de 4 días");
    expect(e.html).toContain('href="https://nexus.example/aprender/git-github-esencial"');
    expect(e.html).toContain("Continuar «Git y GitHub»");
    expect(e.html).toContain("llegar a <strong style=\"color:#fff\">5</strong>");
    expect(e.html).toContain(base.unsubscribe);
    expect(e.text).toContain("https://nexus.example/cuenta/ajustes");
  });
  it("sin curso pendiente lleva a «Mis cursos» y escapa el HTML del nombre", () => {
    const e = streakReminderEmail({ ...base, name: "<b>Eve</b>", streak: 2, courseTitle: null, courseSlug: null });
    expect(e.html).toContain('href="https://nexus.example/cuenta/cursos"');
    expect(e.html).toContain("Ir a mis cursos");
    expect(e.html).not.toContain("<b>Eve</b>");
    expect(e.html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
  });
  it("si no hay nombre, saluda sin inventarlo", () => {
    expect(streakReminderEmail({ ...base, name: "", streak: 3, courseTitle: null, courseSlug: null }).html).toContain("Hola, no pierdas tu racha de 3 días");
  });
});
