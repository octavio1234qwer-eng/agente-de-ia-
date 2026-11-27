// Importe con letra, como se usa en México: "MIL QUINIENTOS PESOS 50/100 M.N."

const UNITS = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ",
  "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE",
  "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const TENS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const HUNDREDS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS",
  "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function below100(n: number): string {
  if (n < 30) return UNITS[n]!;
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? TENS[t]! : `${TENS[t]} Y ${UNITS[u]}`;
}

function below1000(n: number): string {
  if (n === 100) return "CIEN";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [HUNDREDS[h], rest ? below100(rest) : ""].filter(Boolean).join(" ");
}

function apocope(s: string): string {
  return s.replace(/VEINTIUNO$/, "VEINTIÚN").replace(/UNO$/, "UN");
}

/** Número entero a letras (hasta 999,999,999,999). "UNO" se apocopa a "UN" delante de MIL/MILLONES. */
export function integerToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new RangeError("Se espera un entero no negativo");
  if (n === 0) return "CERO";
  if (n >= 1e12) throw new RangeError("Número demasiado grande");
  const millions = Math.floor(n / 1e6);
  const thousands = Math.floor((n % 1e6) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) {
    parts.push(millions === 1 ? "UN MILLÓN" : `${apocope(integerToWords(millions))} MILLONES`);
  }
  if (thousands) parts.push(thousands === 1 ? "MIL" : `${apocope(below1000(thousands))} MIL`);
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}

export function amountInWords(cents: number, currency: "MXN" = "MXN"): string {
  const abs = Math.abs(Math.round(cents));
  const pesos = Math.floor(abs / 100);
  const centavos = String(abs % 100).padStart(2, "0");
  const words = pesos === 0 ? "CERO" : apocope(integerToWords(pesos));
  const unit = pesos === 1 ? "PESO" : "PESOS";
  const de = /(MILLÓN|MILLONES)$/.test(words) ? " DE" : "";
  return `${words}${de} ${unit} ${centavos}/100 ${currency === "MXN" ? "M.N." : currency}`;
}
