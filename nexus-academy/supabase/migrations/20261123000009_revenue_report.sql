-- =============================================================================
-- Reporte de ingresos por producto (curso o paquete) para el administrador.
--
-- Cuenta pedidos cobrados (pagados, con reembolso parcial o total) por fecha de
-- pago. Bruto y descuento salen de cada artículo (el descuento ya se guarda
-- repartido al cobrar). Los reembolsos son por pedido: se reparten entre sus
-- artículos en proporción a su total, y el centavo que sobra del redondeo va al
-- artículo de mayor importe, así que la suma por producto cuadra exacta con los
-- pedidos.
-- =============================================================================

create or replace function public.admin_revenue_by_product(p_from timestamptz default null, p_to timestamptz default null)
returns table (
  item_type text,
  product_id uuid,
  title text,
  slug text,
  currency text,
  orders int,
  units int,
  gross_cents bigint,
  discount_cents bigint,
  refunded_cents bigint,
  net_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with items as (
    select
      oi.order_id,
      oi.item_type::text as item_type,
      coalesce(oi.course_id, oi.bundle_id) as product_id,
      coalesce(c.title, b.title, oi.title) as title,
      coalesce(c.slug, b.slug) as slug,
      o.currency,
      oi.unit_price_cents::bigint as gross,
      oi.discount_cents::bigint as discount,
      oi.total_cents::bigint as total,
      o.refunded_cents::bigint as order_refunded,
      case when o.total_cents > 0 then (o.refunded_cents::bigint * oi.total_cents) / o.total_cents else 0 end as base_refund,
      row_number() over (partition by oi.order_id order by oi.total_cents desc, oi.id) as rn
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    left join public.courses c on c.id = oi.course_id
    left join public.bundles b on b.id = oi.bundle_id
    where o.status in ('paid', 'partially_refunded', 'refunded')
      and o.paid_at is not null
      and (p_from is null or o.paid_at >= p_from)
      and (p_to is null or o.paid_at < p_to)
  ),
  allocated as (
    select i.*,
           i.base_refund + case when i.rn <= (i.order_refunded - sum(i.base_refund) over (partition by i.order_id)) then 1 else 0 end as refund
    from items i
  )
  select a.item_type, a.product_id, max(a.title), max(a.slug), a.currency,
         count(distinct a.order_id)::int, count(*)::int,
         sum(a.gross)::bigint, sum(a.discount)::bigint, sum(a.refund)::bigint, sum(a.total - a.refund)::bigint
    from allocated a
   group by a.item_type, a.product_id, a.currency, case when a.product_id is null then a.title end
   order by sum(a.total - a.refund) desc, max(a.title);
end;
$$;

revoke all on function public.admin_revenue_by_product(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_revenue_by_product(timestamptz, timestamptz) to authenticated;
