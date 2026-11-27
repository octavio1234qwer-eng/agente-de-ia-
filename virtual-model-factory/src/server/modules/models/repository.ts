import type { Queryable } from "../../db/types";
import type { ModelInput } from "@/lib/model-schema";
import type { MODEL_STATUSES } from "@/lib/model-schema";

export type ModelStatus = (typeof MODEL_STATUSES)[number];

export type ModelSummary = {
  id: string;
  slug: string;
  stageName: string;
  fictionalAge: number;
  status: ModelStatus;
  isDemo: boolean;
  contentRating: string;
  languages: string[];
  primaryColor: string;
  secondaryColor: string;
  aesthetic: string;
  updatedAt: Date;
};

export type ModelDetail = ModelSummary & {
  bio: string;
  aiDisclosure: string;
  likenessAttestation: boolean;
  likenessAttestedAt: Date | null;
  targetAudience: string;
  commercialPositioning: string;
  timezone: string;
  styleNotes: string;
  createdAt: Date;
  personality: {
    version: number;
    traits: string[];
    tone: string;
    communicationStyle: string;
    backstory: string;
    interests: string[];
    boundaries: string[];
    samplePhrases: string[];
    conversationHistoryLimit: number;
    escalationKeywords: string[];
  } | null;
  socialAccounts: { id: string; platform: string; handle: string; status: string; isEnabled: boolean; disabledReason: string | null }[];
};

type ModelRow = {
  id: string; slug: string; stage_name: string; fictional_age: number; status: ModelStatus; is_demo: boolean;
  content_rating: string; languages: string[]; visual_identity: Record<string, string>; updated_at: Date;
};

function toSummary(r: ModelRow): ModelSummary {
  return {
    id: r.id, slug: r.slug, stageName: r.stage_name, fictionalAge: r.fictional_age, status: r.status,
    isDemo: r.is_demo, contentRating: r.content_rating, languages: r.languages,
    primaryColor: r.visual_identity.primaryColor ?? "#8b5cf6",
    secondaryColor: r.visual_identity.secondaryColor ?? "#3b82f6",
    aesthetic: r.visual_identity.aesthetic ?? "", updatedAt: r.updated_at,
  };
}

const SUMMARY_COLUMNS = "id, slug, stage_name, fictional_age, status, is_demo, content_rating, languages, visual_identity, updated_at";

export async function listModels(db: Queryable, status?: ModelStatus): Promise<ModelSummary[]> {
  const rows = await db.query<ModelRow>(
    `select ${SUMMARY_COLUMNS} from vmf.models
      where ($1::text is null and status <> 'archived') or status = $1
      order by status = 'active' desc, stage_name`,
    [status ?? null],
  );
  return rows.map(toSummary);
}

export async function getModel(db: Queryable, id: string): Promise<ModelDetail | null> {
  const [r] = await db.query<ModelRow & {
    bio: string; ai_disclosure: string; likeness_attestation: boolean; likeness_attested_at: Date | null;
    target_audience: string; commercial_positioning: string; timezone: string; created_at: Date;
  }>(
    `select ${SUMMARY_COLUMNS}, bio, ai_disclosure, likeness_attestation, likeness_attested_at, target_audience,
            commercial_positioning, timezone, created_at
       from vmf.models where id = $1`,
    [id],
  );
  if (!r) return null;
  const [p] = await db.query<{
    version: number; traits: string[]; tone: string; communication_style: string; backstory: string; interests: string[];
    boundaries: string[]; sample_phrases: string[]; conversation_history_limit: number; escalation_keywords: string[];
  }>("select * from vmf.model_personalities where model_id = $1 and is_active", [id]);
  const accounts = await db.query<{ id: string; platform: string; handle: string; status: string; is_enabled: boolean; disabled_reason: string | null }>(
    "select id, platform, handle, status, is_enabled, disabled_reason from vmf.social_accounts where model_id = $1 order by platform",
    [id],
  );
  return {
    ...toSummary(r),
    bio: r.bio, aiDisclosure: r.ai_disclosure, likenessAttestation: r.likeness_attestation,
    likenessAttestedAt: r.likeness_attested_at, targetAudience: r.target_audience,
    commercialPositioning: r.commercial_positioning, timezone: r.timezone,
    styleNotes: r.visual_identity.styleNotes ?? "", createdAt: r.created_at,
    personality: p
      ? {
          version: p.version, traits: p.traits, tone: p.tone, communicationStyle: p.communication_style,
          backstory: p.backstory, interests: p.interests, boundaries: p.boundaries, samplePhrases: p.sample_phrases,
          conversationHistoryLimit: p.conversation_history_limit, escalationKeywords: p.escalation_keywords,
        }
      : null,
    socialAccounts: accounts.map((a) => ({
      id: a.id, platform: a.platform, handle: a.handle, status: a.status, isEnabled: a.is_enabled, disabledReason: a.disabled_reason,
    })),
  };
}

export async function insertModel(db: Queryable, input: ModelInput, userId: string | null, isDemo = false): Promise<string> {
  const [row] = await db.query<{ id: string }>(
    `insert into vmf.models (slug, stage_name, bio, fictional_age, ai_disclosure, content_rating, target_audience,
        commercial_positioning, languages, timezone, visual_identity, likeness_attestation, likeness_attested_by,
        likeness_attested_at, is_demo, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, case when $12 then now() end, $14, $13)
     returning id`,
    [
      input.slug, input.stageName, input.bio, input.fictionalAge, input.aiDisclosure, input.contentRating,
      input.targetAudience, input.commercialPositioning, input.languages, input.timezone,
      JSON.stringify(input.visualIdentity), input.likenessAttestation, userId, isDemo,
    ],
  );
  await insertPersonality(db, row!.id, input.personality, 1, userId);
  return row!.id;
}

async function insertPersonality(db: Queryable, modelId: string, p: ModelInput["personality"], version: number, userId: string | null) {
  await db.query(
    `insert into vmf.model_personalities (model_id, version, traits, tone, communication_style, backstory, interests,
        boundaries, sample_phrases, conversation_history_limit, escalation_keywords, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [modelId, version, p.traits, p.tone, p.communicationStyle, p.backstory, p.interests, p.boundaries,
      p.samplePhrases, p.conversationHistoryLimit, p.escalationKeywords, userId],
  );
}

/** Actualiza la identidad. La personalidad solo crea versión nueva si cambió. */
export async function updateModel(db: Queryable, id: string, input: ModelInput, userId: string): Promise<boolean> {
  const rows = await db.query(
    `update vmf.models set slug=$2, stage_name=$3, bio=$4, fictional_age=$5, ai_disclosure=$6, content_rating=$7,
        target_audience=$8, commercial_positioning=$9, languages=$10, timezone=$11, visual_identity=$12,
        likeness_attested_by = case when $13 and not likeness_attestation then $14::uuid when not $13 then null else likeness_attested_by end,
        likeness_attested_at = case when $13 and not likeness_attestation then now() when not $13 then null else likeness_attested_at end,
        likeness_attestation=$13,
        status = case when not $13 and status = 'active' then 'paused' else status end
      where id = $1 returning id`,
    [id, input.slug, input.stageName, input.bio, input.fictionalAge, input.aiDisclosure, input.contentRating,
      input.targetAudience, input.commercialPositioning, input.languages, input.timezone,
      JSON.stringify(input.visualIdentity), input.likenessAttestation, userId],
  );
  if (!rows.length) return false;
  const [current] = await db.query<Record<string, unknown>>(
    `select version, traits, tone, communication_style, backstory, interests, boundaries, sample_phrases,
            conversation_history_limit, escalation_keywords
       from vmf.model_personalities where model_id = $1 and is_active`,
    [id],
  );
  const p = input.personality;
  const same =
    current &&
    JSON.stringify([current.traits, current.tone, current.communication_style, current.backstory, current.interests,
      current.boundaries, current.sample_phrases, current.conversation_history_limit, current.escalation_keywords]) ===
      JSON.stringify([p.traits, p.tone, p.communicationStyle, p.backstory, p.interests, p.boundaries, p.samplePhrases,
        p.conversationHistoryLimit, p.escalationKeywords]);
  if (!same) {
    const [{ next }] = (await db.query<{ next: number }>(
      "select coalesce(max(version), 0) + 1 as next from vmf.model_personalities where model_id = $1",
      [id],
    )) as [{ next: number }];
    await db.query("update vmf.model_personalities set is_active = false where model_id = $1 and is_active", [id]);
    await insertPersonality(db, id, p, next, userId);
  }
  return true;
}

export async function setModelStatus(db: Queryable, id: string, status: ModelStatus): Promise<boolean> {
  const rows = await db.query("update vmf.models set status = $2 where id = $1 returning id", [id, status]);
  return rows.length > 0;
}
