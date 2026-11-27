import type { AgentDefinition } from "@/server/orchestrator/agent";
import { ceoAgent } from "./ceo/agent";
import { researchAgent } from "./research/agent";
import { productAgent } from "./product/agent";
import { marketingAgent } from "./marketing/agent";
import { trafficAgent } from "./traffic/agent";
import { salesAgent } from "./sales/agent";
import { financeAgent } from "./finance/agent";
import { deliveryAgent } from "./delivery/agent";
import { auditorAgent } from "./auditor/agent";

export const AGENTS: Record<string, AgentDefinition> = Object.fromEntries(
  [ceoAgent, researchAgent, productAgent, marketingAgent, trafficAgent, salesAgent, financeAgent, deliveryAgent, auditorAgent].map((a) => [a.name, a]),
);
