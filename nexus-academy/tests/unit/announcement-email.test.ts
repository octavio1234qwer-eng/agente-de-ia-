import { describe, expect, it } from "vitest";
import { courseAnnouncementEmail } from "@/lib/email/templates";

const base = { siteUrl: "https://academia.test", unsubscribe: "https://academia.test/baja?e=x&t=y", courseSlug: "git-github-esencial" };

describe("courseAnnouncementEmail", () => {
  it("lleva curso y título en el asunto, enlaza a los avisos y a la baja", () => {
    const e = courseAnnouncementEmail({ ...base, name: "Ana López", courseTitle: "Git y GitHub", title: "Sesión en vivo el jueves", body: "Nos vemos a las 7 pm.\n\nTrae tus dudas." });
    expect(e.subject).toBe("Git y GitHub: Sesión en vivo el jueves");
    expect(e.html).toContain('href="https://academia.test/aprender/git-github-esencial/avisos"');
    expect(e.html).toContain("https://academia.test/baja?e=x&t=y");
    expect(e.html).toContain("Ana:");
    expect(e.text).toContain("Trae tus dudas.");
    expect(e.text).toContain("Desactivar estos correos: https://academia.test/baja?e=x&t=y");
  });

  it("escapa HTML del aviso y recorta textos muy largos", () => {
    const e = courseAnnouncementEmail({ ...base, name: "", courseTitle: "Curso <b>", title: "<img src=x onerror=alert(1)>", body: `<script>alert(1)</script>${"a".repeat(3000)}` });
    expect(e.html).not.toContain("<script>");
    expect(e.html).not.toContain("<img src=x");
    expect(e.html).toContain("&lt;script&gt;");
    expect(e.html).toContain("Hola:");
    expect(e.text).not.toContain("a".repeat(2100));
    expect(e.text).toContain("…");
  });
});
