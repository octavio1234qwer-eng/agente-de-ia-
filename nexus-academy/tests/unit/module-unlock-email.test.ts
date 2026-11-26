import { describe, expect, it } from "vitest";
import { moduleUnlockedEmail } from "@/lib/email/templates";

describe("moduleUnlockedEmail", () => {
  it("nombra el módulo y el curso, enlaza a la primera lección y a la baja", () => {
    const e = moduleUnlockedEmail({ name: "Ana López", courseTitle: "HTML y CSS", moduleTitle: "Semana 2: Flexbox", href: "https://a.test/aprender/html/l1", siteUrl: "https://a.test", unsubscribe: "https://a.test/baja?e=x&t=y" });
    expect(e.subject).toBe("Ya puedes ver «Semana 2: Flexbox» en HTML y CSS");
    expect(e.html).toContain("Ana, se liberó un nuevo módulo");
    expect(e.html).toContain('href="https://a.test/aprender/html/l1"');
    expect(e.html).toContain("https://a.test/baja?e=x&t=y");
    expect(e.text).toContain("Desactivar estos correos: https://a.test/baja?e=x&t=y");
  });

  it("escapa HTML en los títulos", () => {
    const e = moduleUnlockedEmail({ name: "", courseTitle: "<b>Curso</b>", moduleTitle: "<script>x</script>", href: "https://a.test", siteUrl: "https://a.test", unsubscribe: "https://a.test/baja" });
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;b&gt;Curso&lt;/b&gt;");
    expect(e.html).toContain("Hola, se liberó");
  });
});
