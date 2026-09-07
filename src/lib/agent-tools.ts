// Agent tool registry — v4 architecture foundation
// Each tool is a self-contained capability that:
// 1. Checks the kill-switch before running
// 2. Writes an action_ledger row for auditability
// 3. Returns typed output


import { supabase } from "@/lib/supabase";
import { isKilled, getLevel } from "@/lib/autonomy-service";

export interface AgentTool<Input = unknown, Output = unknown> {
  name: string;
  run(businessId: string, input: Input): Promise<Output>;
  estimateCost?(input: Input): number;
}

export interface ToolRunContext {
  businessId: string;
  actorType: "system" | "merchant" | "expert";
  autonomyLevel?: number;
}

const DEFAULT_AUTONOMY_LEVEL = 0;

export async function registerTool<Input, Output>(
  tool: AgentTool<Input, Output>
): Promise<AgentTool<Input, Output>> {
  return tool;
}

async function writeLedgerEntry(
  ctx: ToolRunContext,
  toolName: string,
  inputSummary: string,
  resultSummary: string,
  status: "success" | "failed" | "rolled_back",
  estimatedValuePkr: number = 0,
  reversible: boolean = false
): Promise<void> {
  const autonomyLevel = ctx.autonomyLevel ?? DEFAULT_AUTONOMY_LEVEL;

  const { error } = await supabase
    .from("action_ledger" as never)
    .insert({
      business_id: ctx.businessId,
      actor_type: ctx.actorType,
      tool_name: toolName,
      input_summary: inputSummary,
      result_summary: resultSummary,
      status,
      autonomy_level: autonomyLevel,
      estimated_value_pkr: estimatedValuePkr,
      reversible,
    } as never);

  if (error) {
    console.error(`[agent-tools] Failed to write ledger entry for ${toolName}:`, error);
  }
}

// ============================================================================
// Tool: extract_facts
// Extracts structured business facts from raw merchant input (text, CSV, WA export)
// ============================================================================

export interface ExtractFactsInput {
  sourceType: "text" | "csv" | "whatsapp_export" | "receipt" | "website";
  rawText: string;
  url?: string;
}

export interface ExtractFactsOutput {
  facts: unknown[];
  businessName: string;
  warning?: string;
}

export const extractFactsTool: AgentTool<ExtractFactsInput, ExtractFactsOutput> = {
  name: "extract_facts",

  async run(businessId, input) {
    const killed = await isKilled(businessId);
    if (killed) {
      await writeLedgerEntry(
        { businessId, actorType: "system" },
        "extract_facts",
        JSON.stringify(input).slice(0, 200),
        "blocked: kill-switch active",
        "failed"
      );
      throw new Error("Agent kill-switch is active — extract_facts blocked");
    }

    const autonomyLevel = await getLevel(businessId, "rescan");
    if (autonomyLevel < 1) {
      await writeLedgerEntry(
        { businessId, actorType: "system", autonomyLevel },
        "extract_facts",
        JSON.stringify(input).slice(0, 200),
        "blocked: autonomy level insufficient (need >=1)",
        "failed"
      );
      throw new Error(`Insufficient autonomy level (${autonomyLevel}) for extract_facts`);
    }

    const body =
      input.sourceType === "website" && input.url
        ? { url: input.url }
        : { rawText: input.rawText, sourceType: input.sourceType };

    const { data, error } = await supabase.functions.invoke("extract-facts", {
      body,
    });

    if (error) {
      await writeLedgerEntry(
        { businessId, actorType: "system", autonomyLevel },
        "extract_facts",
        `sourceType=${input.sourceType}`,
        `error: ${error.message}`,
        "failed"
      );
      throw new Error(`extract-facts failed: ${error.message}`);
    }

    const result = data as ExtractFactsOutput;

    await writeLedgerEntry(
      { businessId, actorType: "system", autonomyLevel },
      "extract_facts",
      `sourceType=${input.sourceType}`,
      `extracted ${result.facts?.length ?? 0} facts, businessName=${result.businessName}`,
      "success",
      0,
      true
    );

    return result;
  },

  estimateCost(input) {
    return input.rawText.length;
  },
};

// ============================================================================
// Tool: ask_munshee
// Q&A over the merchant's own business data
// ============================================================================

export interface AskMunsheeInput {
  question: string;
  contextBusinessId?: string;
}

export interface AskMunsheeOutput {
  answer: string;
  sources: string[];
  confidence: number;
}

export const askMunsheeTool: AgentTool<AskMunsheeInput, AskMunsheeOutput> = {
  name: "ask_munshee",

  async run(businessId, input) {
    const killed = await isKilled(businessId);
    if (killed) {
      await writeLedgerEntry(
        { businessId, actorType: "merchant" },
        "ask_munshee",
        input.question.slice(0, 200),
        "blocked: kill-switch active",
        "failed"
      );
      throw new Error("Agent kill-switch is active — ask_munshee blocked");
    }

    const autonomyLevel = await getLevel(businessId, "digest");
    if (autonomyLevel < 2) {
      await writeLedgerEntry(
        { businessId, actorType: "merchant", autonomyLevel },
        "ask_munshee",
        input.question.slice(0, 200),
        "blocked: autonomy level insufficient (need >=2)",
        "failed"
      );
      throw new Error(`Insufficient autonomy level (${autonomyLevel}) for ask_munshee`);
    }

    // Stub — real answer happens in edge functions via OpenRouter
    const answer = "Ask Munshee is not yet wired to the LLM backend.";

    await writeLedgerEntry(
      { businessId, actorType: "merchant", autonomyLevel },
      "ask_munshee",
      input.question.slice(0, 200),
      `stub: answered with ${answer.length} chars`,
      "success",
      0,
      false
    );

    return {
      answer,
      sources: [],
      confidence: 0,
    };
  },

  estimateCost(input) {
    return input.question.length;
  },
};

// ============================================================================
// Registry
// ============================================================================

export const AGENT_TOOLS: Record<string, AgentTool<unknown, unknown>> = {
  extract_facts: extractFactsTool,
  ask_munshee: askMunsheeTool,
};

export function getTool(name: string): AgentTool<unknown, unknown> | undefined {
  return AGENT_TOOLS[name];
}

export function listTools(): string[] {
  return Object.keys(AGENT_TOOLS);
}
