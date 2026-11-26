import { describe, expect, it } from "vitest";
import { cleanQaBody, parseQaThread, qaErrorMessage, QUESTION_MAX } from "@/lib/qa";
import { questionAnsweredEmail } from "@/lib/email/templates";

describe("preguntas y respuestas", () => {
  it("lee el hilo de lesson_qa y descarta elementos sin forma válida", () => {
    const thread = parseQaThread([
      {
        id: "q1", body: "¿Qué es un commit?", created_at: "2026-11-26T10:00:00Z", edited: false, is_mine: true,
        author: "Ana G.", author_is_staff: false, hidden: false, answered: true,
        answers: [
          { id: "a1", body: "Una foto del proyecto", created_at: "2026-11-26T11:00:00Z", is_staff: true, author: "Equipo A.", is_mine: false, hidden: false, edited: true },
          { body: "sin id" },
          "basura",
        ],
      },
      { id: "", body: "sin id" },
      null,
      { id: "q2", body: "Otra", answers: "no es arreglo" },
    ]);
    expect(thread).toHaveLength(2);
    expect(thread[0].answers).toHaveLength(1);
    expect(thread[0].answers[0]).toMatchObject({ id: "a1", is_staff: true, edited: true });
    expect(thread[1]).toMatchObject({ id: "q2", author: "Alumno", answered: false, answers: [] });
    expect(parseQaThread(null)).toEqual([]);
    expect(parseQaThread({ id: "x" })).toEqual([]);
  });

  it("limpia el texto sin perder párrafos", () => {
    expect(cleanQaBody("  Hola\r\n\r\n\r\n\r\nmundo \n")).toBe("Hola\n\nmundo");
    expect(cleanQaBody(null)).toBe("");
  });

  it("traduce los errores de la base a mensajes claros", () => {
    expect(qaErrorMessage({ code: "P0001", message: "rate_limited" }, "question")).toMatch(/20 preguntas/);
    expect(qaErrorMessage({ code: "P0001", message: "rate_limited" }, "answer")).toMatch(/60 respuestas/);
    expect(qaErrorMessage({ code: "42501", message: "new row violates row-level security policy" }, "question")).toMatch(/inscritos/);
    expect(qaErrorMessage({ code: "23514", message: "check" }, "question")).toContain(String(QUESTION_MAX));
    expect(qaErrorMessage(null, "answer")).toBeNull();
  });

  it("el correo de respuesta escapa HTML y enlaza a la pregunta", () => {
    const email = questionAnsweredEmail({
      name: "Ana Gómez",
      courseTitle: "Git <esencial>",
      lessonTitle: "Primer commit",
      question: "¿<script>alert(1)</script>?",
      answer: "Usa `git add` & luego commit",
      href: "https://academia.test/aprender/git/abc#pregunta-q1",
      siteUrl: "https://academia.test",
    });
    expect(email.subject).toBe("Respondieron tu pregunta en «Primer commit»");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("Git &lt;esencial&gt;");
    expect(email.html).toContain("https://academia.test/aprender/git/abc#pregunta-q1");
    expect(email.text).toContain("Ana, el equipo respondió");
  });

  it("recorta respuestas muy largas en el correo", () => {
    const email = questionAnsweredEmail({ name: "", courseTitle: "C", lessonTitle: "L", question: "q".repeat(500), answer: "a".repeat(3000), href: "https://x.test", siteUrl: "https://x.test" });
    expect(email.text).toContain(`${"q".repeat(299)}…`);
    expect(email.text).not.toContain("a".repeat(1300));
    expect(email.html).toContain("Hola, ya tienes respuesta");
  });
});
