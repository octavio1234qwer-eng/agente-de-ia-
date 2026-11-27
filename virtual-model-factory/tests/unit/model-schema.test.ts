import { describe, expect, it } from "vitest";
import { modelInputFromForm, modelInputSchema, splitList } from "@/lib/model-schema";
import { DEMO_MODELS } from "@/server/modules/demo/seed";

function validForm(): FormData {
  const f = new FormData();
  f.set("slug", "nova-test");
  f.set("stageName", "Nova Test");
  f.set("fictionalAge", "28");
  f.set("aiDisclosure", "Personaje virtual creado con IA.");
  f.set("contentRating", "sfw");
  f.append("languages", "es");
  f.append("languages", "en");
  f.set("primaryColor", "#112233");
  f.set("secondaryColor", "#445566");
  f.set("traits", "alegre, curiosa");
  f.set("boundaries", "No pedir datos personales.\nNo afirmar ser humana.");
  f.set("likenessAttestation", "on");
  return f;
}

describe("esquema de modelo", () => {
  it("acepta un formulario válido", () => {
    const parsed = modelInputSchema.parse(modelInputFromForm(validForm()));
    expect(parsed.languages).toEqual(["es", "en"]);
    expect(parsed.personality.traits).toEqual(["alegre", "curiosa"]);
    expect(parsed.personality.boundaries).toHaveLength(2);
    expect(parsed.likenessAttestation).toBe(true);
  });
  it("rechaza edades menores de 25", () => {
    const f = validForm();
    f.set("fictionalAge", "24");
    const r = modelInputSchema.safeParse(modelInputFromForm(f));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/25/);
  });
  it("exige divulgación de IA, idiomas y slug válido", () => {
    const f = validForm();
    f.set("aiDisclosure", "IA");
    f.delete("languages");
    f.set("slug", "Slug Inválido");
    const r = modelInputSchema.safeParse(modelInputFromForm(f));
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["aiDisclosure", "languages", "slug"]));
  });
  it("splitList ignora vacíos", () => {
    expect(splitList(" a, ,b\n c ")).toEqual(["a", "b", "c"]);
  });
  it("los modelos de demostración son válidos, adultos y marcados", () => {
    expect(DEMO_MODELS).toHaveLength(3);
    for (const m of DEMO_MODELS) {
      expect(modelInputSchema.safeParse(m).success).toBe(true);
      expect(m.fictionalAge).toBeGreaterThanOrEqual(25);
      expect(m.slug.startsWith("demo-")).toBe(true);
      expect(m.aiDisclosure.toLowerCase()).toContain("ia");
    }
  });
});
