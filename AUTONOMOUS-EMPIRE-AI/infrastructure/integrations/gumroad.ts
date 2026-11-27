/** Gumroad (productos digitales): solo LECTURA de ventas y productos para conciliar el libro. */
const API = "https://api.gumroad.com/v2";

export interface GumroadSale {
  id: string; created_at: string; product_name: string; product_id: string;
  price: number; // centavos de la moneda
  currency_symbol?: string; currency?: string;
  gumroad_fee?: number; refunded?: boolean; chargedback?: boolean; disputed?: boolean;
}

export async function fetchSales(opts: { after?: string; token?: string; fetchFn?: typeof fetch } = {}): Promise<GumroadSale[]> {
  const token = opts.token ?? process.env.GUMROAD_ACCESS_TOKEN ?? "proxy-injected";
  const f = opts.fetchFn ?? fetch;
  const out: GumroadSale[] = [];
  let url: string | null = `${API}/sales${opts.after ? `?after=${encodeURIComponent(opts.after)}` : ""}`;
  for (let page = 0; url && page < 50; page++) {
    const res: Response = await f(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Gumroad ${res.status}`);
    const j = (await res.json()) as { success: boolean; sales: GumroadSale[]; next_page_url?: string | null };
    if (!j.success) throw new Error("Gumroad: respuesta sin éxito");
    out.push(...j.sales);
    url = j.next_page_url ? new URL(j.next_page_url, "https://api.gumroad.com").toString() : null;
  }
  return out;
}

export async function fetchProducts(opts: { token?: string; fetchFn?: typeof fetch } = {}) {
  const token = opts.token ?? process.env.GUMROAD_ACCESS_TOKEN ?? "proxy-injected";
  const res = await (opts.fetchFn ?? fetch)(`${API}/products`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Gumroad ${res.status}`);
  const j = (await res.json()) as { products: { id: string; name: string; price: number; currency: string; published: boolean; short_url: string }[] };
  return j.products;
}
