import Anthropic from '@anthropic-ai/sdk';
import Ajv from 'ajv';
import type { AnthropicUsage, QueryTemplateOutputSchema } from '@code-analyzer/shared';
import { FindingsResponseJsonSchema, DependencyMapResponseJsonSchema } from '@code-analyzer/shared';
import { SchemaValidationError } from './errors.js';
import { config } from '../config.js';

const ajv = new Ajv({ strict: false, allErrors: true });
const validators: Record<QueryTemplateOutputSchema, ReturnType<Ajv['compile']>> = {
  FindingsResponse: ajv.compile(FindingsResponseJsonSchema),
  DependencyMapResponse: ajv.compile(DependencyMapResponseJsonSchema),
};

const TOOL_NAME_BY_SCHEMA: Record<QueryTemplateOutputSchema, string> = {
  FindingsResponse: 'submit_findings',
  DependencyMapResponse: 'submit_dependency_map',
};

export interface QueryContext {
  codebaseId: string;
  contextBlockText: string;
  userQuery: string;
  outputSchema: QueryTemplateOutputSchema;
}

export interface AnthropicQueryResult {
  result: unknown;
  usage: AnthropicUsage;
}

export interface AnthropicClient {
  query(ctx: QueryContext): Promise<AnthropicQueryResult>;
}

function toolDefinitionFor(outputSchema: QueryTemplateOutputSchema) {
  const jsonSchema =
    outputSchema === 'FindingsResponse' ? FindingsResponseJsonSchema : DependencyMapResponseJsonSchema;
  return {
    name: TOOL_NAME_BY_SCHEMA[outputSchema],
    description: `Submit the ${outputSchema} result of the analysis.`,
    input_schema: jsonSchema as unknown as Anthropic.Tool.InputSchema,
  };
}

/**
 * Builds the messages array for a query. The leading content block (contextBlockText) always
 * carries cache_control: ephemeral so that repeated calls for the same codebaseId, with the
 * exact same byte-for-byte block, hit Anthropic's prompt cache instead of re-billing full input.
 */
function buildMessages(ctx: QueryContext, retryNote?: string): Anthropic.MessageParam[] {
  const userText = retryNote ? `${ctx.userQuery}\n\n${retryNote}` : ctx.userQuery;
  return [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: ctx.contextBlockText,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: userText,
        },
      ],
    },
  ];
}

export class RealAnthropicClient implements AnthropicClient {
  private client: Anthropic;

  constructor(apiKey: string = config.anthropicApiKey) {
    this.client = new Anthropic({ apiKey });
  }

  async query(ctx: QueryContext): Promise<AnthropicQueryResult> {
    return runQueryWithValidation(ctx, (messages) => this.callModel(messages, ctx.outputSchema));
  }

  private async callModel(
    messages: Anthropic.MessageParam[],
    outputSchema: QueryTemplateOutputSchema,
  ): Promise<{ toolInput: unknown; usage: AnthropicUsage }> {
    const tool = toolDefinitionFor(outputSchema);
    const response = await this.client.messages.create({
      model: config.anthropicModel,
      max_tokens: 4096,
      messages,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
    });

    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
    if (!toolUseBlock) {
      throw new Error('Model did not return a tool_use block');
    }

    return {
      toolInput: toolUseBlock.input,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      },
    };
  }
}

async function runQueryWithValidation(
  ctx: QueryContext,
  callModel: (messages: Anthropic.MessageParam[]) => Promise<{ toolInput: unknown; usage: AnthropicUsage }>,
): Promise<AnthropicQueryResult> {
  const validate = validators[ctx.outputSchema];

  const firstMessages = buildMessages(ctx);
  const first = await callModel(firstMessages);
  if (validate(first.toolInput)) {
    return { result: first.toolInput, usage: first.usage };
  }

  const firstErrors = ajv.errorsText(validate.errors ?? []);
  const retryMessages = buildMessages(
    ctx,
    `Your previous response failed schema validation with these errors: ${firstErrors}. Please call the tool again with corrected, schema-valid input.`,
  );
  const second = await callModel(retryMessages);
  if (validate(second.toolInput)) {
    return { result: second.toolInput, usage: second.usage };
  }

  const secondErrors = ajv.errorsText(validate.errors ?? []);
  throw new SchemaValidationError(
    `Response failed schema validation twice: ${secondErrors}`,
    validate.errors,
  );
}

// --- Mock client for tests / LLM_MOCK=1 ---

export interface MockAnthropicResponder {
  (ctx: QueryContext, attempt: 1 | 2): { toolInput: unknown; usage: AnthropicUsage };
}

export class MockAnthropicClient implements AnthropicClient {
  public calls: { messages: Anthropic.MessageParam[]; ctx: QueryContext }[] = [];

  constructor(private respond: MockAnthropicResponder) {}

  async query(ctx: QueryContext): Promise<AnthropicQueryResult> {
    return runQueryWithValidation(ctx, async (messages) => {
      this.calls.push({ messages, ctx });
      const attempt = this.calls.filter((c) => c.ctx === ctx).length as 1 | 2;
      return this.respond(ctx, attempt);
    });
  }
}

export function defaultCannedFindingsResponse(): { toolInput: unknown; usage: AnthropicUsage } {
  return {
    toolInput: {
      summary: 'Mocked analysis summary.',
      findings: [
        {
          id: 'mock-1',
          title: 'Example finding',
          category: 'security',
          severity: 'medium',
          explanation: 'This is a canned mock finding used when LLM_MOCK=1.',
          file_path: 'src/index.ts',
          line_start: 1,
          line_end: 3,
          code_snippet: 'console.log("hello")',
          suggested_fix: {
            description: 'Remove the stray console.log call.',
            diff: `--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,2 @@
-console.log("hello")
 export const main = () => 1;
`,
          },
        },
      ],
    },
    usage: {
      input_tokens: 500,
      output_tokens: 200,
      cache_creation_input_tokens: 5000,
      cache_read_input_tokens: 0,
    },
  };
}

/**
 * Default mock used for local/dev/E2E runs (LLM_MOCK=1). Tracks how many completed queries
 * each codebaseId has had so the *second* real query against the same codebase returns a
 * canned response with a distinct, nonzero cache_read_input_tokens value — this is what the
 * cost dashboard's cache-hit assertion in the E2E suite checks for.
 */
export function createDefaultMockClient(): AnthropicClient {
  const queryCountByCodebase = new Map<string, number>();
  return new MockAnthropicClient((ctx, attempt) => {
    const base = defaultCannedFindingsResponse();
    if (attempt === 2) {
      return { ...base, usage: { ...base.usage, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0 } };
    }
    const priorQueries = queryCountByCodebase.get(ctx.codebaseId) ?? 0;
    queryCountByCodebase.set(ctx.codebaseId, priorQueries + 1);
    if (priorQueries > 0) {
      return {
        ...base,
        usage: { ...base.usage, cache_creation_input_tokens: 0, cache_read_input_tokens: 4321 },
      };
    }
    return base;
  });
}
