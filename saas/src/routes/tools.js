import express from 'express';
import { z } from 'zod';
import { buildPrompt, getTool, publicTool, toolName, toolTitle, tools } from '../ai/tools.js';
import { HttpError, notFound, parse } from '../lib/http.js';
import { formatDay } from '../i18n.js';
import { errorFields } from '../lib/logger.js';
import { requireUser, requireVerified } from '../middleware/auth.js';
import { effectivePlanId } from '../plans.js';
import { rateLimit } from '../services/rateLimit.js';
import { nextPeriodStartLabel, periodFor, refundCredits, reserveCredits, usageSummary } from '../services/usage.js';

const uuid = z.uuid();

/** Construye el validador del formulario de una herramienta según el plan del usuario. */
function inputSchema(tool, plan) {
  const shape = {};
  for (const field of tool.fields) {
    if (field.type === 'select') {
      const schema = z.enum(field.options, { error: 'v.option' });
      shape[field.name] = field.required
        ? schema
        : z.union([schema, z.literal('')]).optional().transform((value) => value || undefined);
      continue;
    }
    const max = Math.min(field.maxLength, plan.maxInputChars);
    const schema = z.string().trim().max(max, 'v.max_chars_plan');
    shape[field.name] = field.required
      ? schema.min(1, 'v.required')
      : schema.optional().transform((value) => value || undefined);
  }
  return z.object(shape).strict();
}

function generationListItem(row, locale) {
  const tool = getTool(row.tool_id);
  return {
    id: row.id,
    toolId: row.tool_id,
    toolName: tool ? toolName(tool, locale) : row.tool_id,
    title: row.title,
    credits: row.credits,
    createdAt: row.created_at,
  };
}

const PURGE_SQL = "input = '{}'::jsonb, output = NULL, title = NULL, purged_at = now()";

export function toolsRouter(ctx) {
  const { db, config, logger, plans, ai, limits } = ctx;
  const router = express.Router();
  const planOf = (user) => plans.get(effectivePlanId(user));

  router.get('/tools', (req, res) => {
    const plan = planOf(req.user);
    res.json({ tools: tools.map((tool) => publicTool(tool, plan, req.locale)) });
  });

  router.post('/tools/:id/run',
    requireUser,
    requireVerified(config),
    rateLimit(db, { name: 'run', ...limits.run, keys: (req) => [`user:${req.user.id}`] }),
    async (req, res) => {
      const tool = getTool(req.params.id);
      if (!tool) throw notFound('tools.not_found');
      const user = req.user;
      const plan = planOf(user);
      if (tool.premium && !plan.premiumTools) {
        throw new HttpError(403, 'upgrade_required', 'tools.upgrade_required', undefined, { tool: toolName(tool, req.locale) });
      }
      const input = parse(inputSchema(tool, plan), req.body?.input);
      const totalChars = Object.values(input).reduce((sum, value) => sum + (value ? String(value).length : 0), 0);
      if (totalChars > plan.maxInputChars) {
        throw new HttpError(400, 'input_too_long', 'tools.input_too_long', undefined, { max: plan.maxInputChars });
      }

      // Se reservan los créditos antes de llamar a la IA (atómico) y se devuelven si la IA falla.
      const period = periodFor(new Date(), config.timezone);
      const reserved = await reserveCredits(db, { userId: user.id, period, cost: tool.credits, limit: plan.monthlyCredits });
      if (!reserved) {
        throw new HttpError(402, 'quota_exceeded', 'tools.quota_exceeded', undefined,
          { credits: tool.credits, date: formatDay(req.locale, nextPeriodStartLabel(period)) });
      }

      const started = Date.now();
      let result;
      try {
        result = await ai.generate(buildPrompt(tool, input, { locale: user.locale ?? req.locale, currency: user.currency, country: user.country }));
        if (!result.text?.trim()) throw Object.assign(new Error('Respuesta vacía del proveedor de IA'), { code: 'empty_output' });
      } catch (error) {
        await refundCredits(db, { userId: user.id, period, cost: tool.credits });
        await db.query(
          `INSERT INTO generations (user_id, tool_id, input, status, credits, provider, model, latency_ms, error_code)
           VALUES ($1, $2, '{}'::jsonb, 'failed', 0, $3, $4, $5, $6)`,
          [user.id, tool.id, ai.name, ai.model, Date.now() - started, String(error.status ?? error.code ?? 'error').slice(0, 40)],
        );
        logger.error('falló la generación', { user: user.id, tool: tool.id, requestId: req.id, ...errorFields(error) });
        throw new HttpError(502, 'ai_unavailable', 'tools.ai_unavailable');
      }

      const output = result.text.trim();
      const { rows } = await db.query(
        `INSERT INTO generations (user_id, tool_id, title, input, output, status, credits, provider, model,
           input_tokens, output_tokens, latency_ms)
         VALUES ($1, $2, $3, $4, $5, 'succeeded', $6, $7, $8, $9, $10, $11)
         RETURNING id, created_at`,
        [user.id, tool.id, toolTitle(tool, input), input, output, tool.credits, result.provider, result.model,
          result.inputTokens, result.outputTokens, Date.now() - started],
      );
      res.status(201).json({
        generation: {
          id: rows[0].id,
          toolId: tool.id,
          toolName: toolName(tool, req.locale),
          output,
          credits: tool.credits,
          createdAt: rows[0].created_at,
        },
        usage: await usageSummary(db, user.id, plan, config.timezone),
      });
    });

  router.get('/generations', requireUser, async (req, res) => {
    const query = parse(z.object({
      page: z.coerce.number().int().min(1).max(1000).default(1),
      tool: z.string().max(60).optional(),
    }), req.query);
    const plan = planOf(req.user);
    const pageSize = 20;
    const { rows } = await db.query(
      `SELECT id, tool_id, title, credits, created_at FROM generations
       WHERE user_id = $1 AND status = 'succeeded' AND purged_at IS NULL
         AND created_at >= now() - ($2::int * interval '1 day')
         AND ($5::text IS NULL OR tool_id = $5::text)
       ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [req.user.id, plan.historyDays, pageSize + 1, (query.page - 1) * pageSize, query.tool ?? null],
    );
    res.json({
      items: rows.slice(0, pageSize).map((row) => generationListItem(row, req.locale)),
      page: query.page,
      hasMore: rows.length > pageSize,
      historyDays: plan.historyDays,
    });
  });

  router.get('/generations/:id', requireUser, async (req, res) => {
    if (!uuid.safeParse(req.params.id).success) throw notFound();
    const plan = planOf(req.user);
    const { rows } = await db.query(
      `SELECT * FROM generations
       WHERE id = $1 AND user_id = $2 AND status = 'succeeded' AND purged_at IS NULL
         AND created_at >= now() - ($3::int * interval '1 day')`,
      [req.params.id, req.user.id, plan.historyDays],
    );
    const row = rows[0];
    if (!row) throw notFound('gen.not_found');
    res.json({ generation: { ...generationListItem(row, req.locale), input: row.input, output: row.output } });
  });

  // Al borrar se elimina el contenido y se conserva el registro para que las estadísticas cuadren.
  router.delete('/generations/:id', requireUser, async (req, res) => {
    if (!uuid.safeParse(req.params.id).success) throw notFound();
    const { rows } = await db.query(
      `UPDATE generations SET ${PURGE_SQL} WHERE id = $1 AND user_id = $2 AND purged_at IS NULL RETURNING id`,
      [req.params.id, req.user.id],
    );
    if (!rows.length) throw notFound();
    res.status(204).end();
  });

  router.delete('/generations', requireUser, async (req, res) => {
    await db.query(`UPDATE generations SET ${PURGE_SQL} WHERE user_id = $1 AND purged_at IS NULL`, [req.user.id]);
    res.status(204).end();
  });

  return router;
}
