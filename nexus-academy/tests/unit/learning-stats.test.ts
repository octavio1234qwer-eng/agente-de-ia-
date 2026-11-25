import { describe, expect, it } from "vitest";
import {
  dayLabel, dayStatus, daysLeftInWeek, goalMessage, goalPercent, isTimeZoneName, parseGoal,
  parseLearningStats, streakMessage, timeZoneOptions, utcOffset,
} from "@/lib/learning-stats";

const week = (active: number[], lessons: Record<number, number> = {}) =>
  Array.from({ length: 7 }, (_, i) => ({ date: `2026-11-${String(23 + i).padStart(2, "0")}`, active: active.includes(i), lessons: lessons[i] ?? 0 }));

const base = {
  time_zone: "America/Mexico_City", today: "2026-11-25", week_start: "2026-11-23",
  current_streak: 2, longest_streak: 5, active_today: true, weekly_goal: 3, week_lessons: 1, week: week([0, 1, 2], { 2: 1 }),
};

describe("parseLearningStats", () => {
  it("acepta la respuesta de la base", () => expect(parseLearningStats(base)).toEqual(base));
  it("rechaza datos incompletos o fuera de rango", () => {
    expect(parseLearningStats(null)).toBeNull();
    expect(parseLearningStats({ ...base, week: week([]).slice(0, 6) })).toBeNull();
    expect(parseLearningStats({ ...base, weekly_goal: 0 })).toBeNull();
    expect(parseLearningStats({ ...base, current_streak: -1 })).toBeNull();
  });
});

describe("días de la semana", () => {
  it("distingue estudiado, hoy sin actividad, perdido y futuro", () => {
    const w = week([0]);
    expect(dayStatus(w[0], "2026-11-25")).toBe("active");
    expect(dayStatus(w[1], "2026-11-25")).toBe("missed");
    expect(dayStatus(w[2], "2026-11-25")).toBe("today");
    expect(dayStatus(w[3], "2026-11-25")).toBe("future");
  });
  it("describe cada día para lectores de pantalla", () => {
    const w = week([2], { 2: 2 });
    expect(dayLabel(w[2], 2, "2026-11-25")).toBe("miércoles 25 (hoy): estudiaste, 2 lecciones completadas");
    expect(dayLabel(w[0], 0, "2026-11-25")).toBe("lunes 23: sin actividad");
    expect(dayLabel(w[6], 6, "2026-11-25")).toBe("domingo 29: todavía no llega");
    expect(dayLabel(week([])[2], 2, "2026-11-25")).toBe("miércoles 25 (hoy): aún sin actividad");
  });
});

describe("mensajes", () => {
  it("racha", () => {
    expect(streakMessage({ current_streak: 0, longest_streak: 0, active_today: false })).toMatch(/empezar tu racha/);
    expect(streakMessage({ current_streak: 0, longest_streak: 4, active_today: false })).toMatch(/se reinició/);
    expect(streakMessage({ current_streak: 1, longest_streak: 1, active_today: true })).toBe("¡Ya estudiaste hoy! Vuelve mañana para llegar a 2 días.");
    expect(streakMessage({ current_streak: 1, longest_streak: 3, active_today: false })).toBe("Estudia hoy para mantener tu racha de 1 día.");
  });
  it("meta semanal con los días que quedan (contando hoy)", () => {
    expect(daysLeftInWeek({ week_start: "2026-11-23", today: "2026-11-23" })).toBe(7);
    expect(daysLeftInWeek({ week_start: "2026-11-23", today: "2026-11-29" })).toBe(1);
    expect(goalMessage(base)).toBe("Te faltan 2 lecciones y quedan 5 días de la semana.");
    expect(goalMessage({ ...base, week_lessons: 2, today: "2026-11-29" })).toBe("Te falta 1 lección y queda 1 día de la semana.");
    expect(goalMessage({ ...base, week_lessons: 4 })).toBe("¡Meta cumplida! Completaste 4 lecciones esta semana.");
    expect(goalPercent({ week_lessons: 1, weekly_goal: 3 })).toBe(33);
    expect(goalPercent({ week_lessons: 9, weekly_goal: 3 })).toBe(100);
  });
});

describe("validación", () => {
  it("meta entre 1 y 50 lecciones enteras", () => {
    expect(parseGoal("5")).toBe(5);
    expect(parseGoal(" 50 ")).toBe(50);
    for (const bad of ["0", "51", "2.5", "", "abc", null]) expect(parseGoal(bad)).toBeNull();
  });
  it("nombres de zona horaria", () => {
    for (const ok of ["America/Mexico_City", "America/Argentina/Buenos_Aires", "UTC", "Etc/GMT+5"]) expect(isTimeZoneName(ok)).toBe(true);
    for (const bad of ["", "mexico", "America/../etc", "America/Mexico City", "x".repeat(70), 5]) expect(isTimeZoneName(bad)).toBe(false);
  });
  it("desfase y opciones del selector", () => {
    expect(utcOffset("America/Bogota", new Date("2026-11-25T12:00:00Z"))).toBe("GMT-5");
    expect(utcOffset("Zona/Inexistente")).toBe("");
    const opts = timeZoneOptions("America/Mexico_City", "Asia/Tokyo");
    expect(opts.filter((o) => o.value === "America/Mexico_City")).toHaveLength(1);
    expect(opts.at(-1)).toEqual({ value: "Asia/Tokyo", label: "Asia/Tokyo" });
  });
});
