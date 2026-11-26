/** Preguntas y respuestas por lección: límites, tipos y lectura segura del hilo. */

export const QUESTION_MIN = 5;
export const QUESTION_MAX = 2000;
export const ANSWER_MAX = 3000;

export type QaAnswer = {
  id: string;
  body: string;
  created_at: string;
  edited: boolean;
  is_mine: boolean;
  author: string;
  is_staff: boolean;
  hidden: boolean;
};

export type QaQuestion = {
  id: string;
  body: string;
  created_at: string;
  edited: boolean;
  is_mine: boolean;
  author: string;
  author_is_staff: boolean;
  hidden: boolean;
  answered: boolean;
  answers: QaAnswer[];
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const bool = (v: unknown) => v === true;

function parseAnswer(v: unknown): QaAnswer | null {
  if (!isObj(v) || !str(v.id)) return null;
  return {
    id: str(v.id),
    body: str(v.body),
    created_at: str(v.created_at),
    edited: bool(v.edited),
    is_mine: bool(v.is_mine),
    author: str(v.author) || "Alumno",
    is_staff: bool(v.is_staff),
    hidden: bool(v.hidden),
  };
}

/** Convierte el JSON de `lesson_qa()` en datos tipados, descartando lo que no tenga forma válida. */
export function parseQaThread(json: unknown): QaQuestion[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((v): QaQuestion[] => {
    if (!isObj(v) || !str(v.id)) return [];
    return [{
      id: str(v.id),
      body: str(v.body),
      created_at: str(v.created_at),
      edited: bool(v.edited),
      is_mine: bool(v.is_mine),
      author: str(v.author) || "Alumno",
      author_is_staff: bool(v.author_is_staff),
      hidden: bool(v.hidden),
      answered: bool(v.answered),
      answers: (Array.isArray(v.answers) ? v.answers : []).map(parseAnswer).filter((a): a is QaAnswer => a !== null),
    }];
  });
}

/** Normaliza el texto que escribe el alumno (saltos de línea y espacios sobrantes). */
export function cleanQaBody(raw: unknown) {
  return String(raw ?? "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Mensaje en español para los errores que devuelve la base al preguntar o responder. */
export function qaErrorMessage(error: { code?: string; message?: string } | null | undefined, kind: "question" | "answer") {
  if (!error) return null;
  if (error.message?.includes("rate_limited")) {
    return kind === "question"
      ? "Llegaste al límite de 20 preguntas en 24 horas. Intenta más tarde."
      : "Llegaste al límite de 60 respuestas en 24 horas. Intenta más tarde.";
  }
  if (error.code === "42501") {
    return kind === "question"
      ? "Solo los alumnos inscritos en el curso pueden preguntar."
      : "Esta pregunta ya no acepta respuestas o no tienes acceso al curso.";
  }
  if (error.code === "23514") {
    return kind === "question"
      ? `La pregunta debe tener entre ${QUESTION_MIN} y ${QUESTION_MAX} caracteres.`
      : `La respuesta debe tener entre 1 y ${ANSWER_MAX} caracteres.`;
  }
  if (error.message?.includes("lesson_not_found") || error.message?.includes("question_not_found")) {
    return kind === "question" ? "La lección ya no existe." : "La pregunta ya no existe.";
  }
  return kind === "question" ? "No se pudo publicar tu pregunta. Intenta de nuevo." : "No se pudo publicar tu respuesta. Intenta de nuevo.";
}
