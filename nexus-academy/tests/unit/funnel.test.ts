import { describe, expect, it } from "vitest";
import { parseFunnel, pct, topDropOffs } from "@/lib/funnel";

const lesson = (idx: number, stuck: number, completed = 0) => ({ lesson_id: `l${idx}`, idx, title: `L${idx}`, type: "video", module_title: "M", completed, stuck });
const base = { enrolled: 5, started: 4, not_started: 1, completed: 1, completion_rate: 20, lessons: [lesson(1, 0, 4), lesson(2, 2, 2), lesson(3, 1, 2)] };

describe("embudo", () => {
  it("valida la respuesta de la base", () => {
    expect(parseFunnel(base)).toEqual(base);
    expect(parseFunnel({ ...base, completion_rate: 120 })).toBeNull();
    expect(parseFunnel({ ...base, lessons: [{ ...lesson(1, 0), stuck: -1 }] })).toBeNull();
    expect(parseFunnel(null)).toBeNull();
  });
  it("porcentajes sin dividir entre cero", () => {
    expect(pct(2, 4)).toBe(50);
    expect(pct(1, 3)).toBe(33);
    expect(pct(3, 0)).toBe(0);
  });
  it("ordena las lecciones donde más se detienen; en empate, la primera del temario", () => {
    const f = { ...base, lessons: [lesson(1, 0), lesson(2, 2), lesson(3, 1), lesson(4, 2), lesson(5, 3)] };
    expect(topDropOffs(f).map((l) => l.idx)).toEqual([5, 2, 4]);
    expect(topDropOffs({ ...base, lessons: [lesson(1, 0)] })).toEqual([]);
  });
});
