/**
 * LLM Service - VideoDB Proxy
 *
 * Provides LLM capabilities through VideoDB's OpenAI-compatible API proxy.
 * Uses the OpenAI SDK for cleaner API interactions.
 */

import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
  ChatCompletionAssistantMessageParam,
} from 'openai/resources/chat/completions';
import { logger } from '../lib/logger';
import { loadAppConfig, loadRuntimeConfig } from '../lib/config';

const log = logger.child({ module: 'llm-service' });

export interface LLMConfig {
  apiKey: string;
  apiBase: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description?: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
}

export interface ToolCallResponse {
  content: string | null;
  tool_calls: ToolCall[] | null;
  success: boolean;
  error?: string;
  finishReason?: string;
}

export interface LLMResponse {
  content: string;
  success: boolean;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface JSONLLMResponse<T = unknown> {
  data: T | null;
  success: boolean;
  error?: string;
  raw?: string;
}

export class LLMService {
  private config: LLMConfig;
  private client: OpenAI;
  private static instance: LLMService | null = null;

  constructor(config?: Partial<LLMConfig>) {
    const appConfig = loadAppConfig();
    const runtimeConfig = loadRuntimeConfig();

    this.config = {
      apiKey: config?.apiKey || appConfig.apiKey || '',
      apiBase: config?.apiBase || runtimeConfig.apiUrl || 'https://api.videodb.io',
      model: config?.model || 'ultra',
      maxTokens: config?.maxTokens || 4096,
      temperature: config?.temperature || 0.7,
    };

    // Initialize OpenAI client with VideoDB proxy base URL
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.apiBase,
    });

    log.info({
      apiBase: this.config.apiBase,
      model: this.config.model,
    }, 'LLM Service initialized with OpenAI SDK');
  }

  static getInstance(config?: Partial<LLMConfig>): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService(config);
    }
    return LLMService.instance;
  }

  static resetInstance(): void {
    LLMService.instance = null;
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    // Reinitialize client with new API key
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.apiBase,
    });
  }

  /**
   * Convert our ChatMessage format to OpenAI's format
   */
  private formatMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
    return messages.map((msg): ChatCompletionMessageParam => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: msg.content || '',
          tool_call_id: msg.tool_call_id || '',
        } as ChatCompletionToolMessageParam;
      }

      if (msg.role === 'assistant' && msg.tool_calls) {
        return {
          role: 'assistant',
          content: msg.content,
          tool_calls: msg.tool_calls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        } as ChatCompletionAssistantMessageParam;
      }

      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content || '',
      };
    });
  }

  /**
   * Convert our Tool format to OpenAI's format
   */
  private formatTools(tools: Tool[]): ChatCompletionTool[] {
    return tools.map((tool): ChatCompletionTool => ({
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters as Record<string, unknown>,
      },
    }));
  }

  async chatCompletion(messages: ChatMessage[]): Promise<LLMResponse> {
    if (!this.config.apiKey) {
      log.error('LLM API key not configured');
      return {
        content: '',
        success: false,
        error: 'API key not configured',
      };
    }

    const startTime = Date.now();
    const messagePreview = messages[messages.length - 1]?.content?.slice(0, 100) || '';
    log.info({
      apiBase: this.config.apiBase,
      model: this.config.model,
      messageCount: messages.length,
      messagePreview,
    }, 'LLM request starting');

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: this.formatMessages(messages),
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      const elapsed = Date.now() - startTime;
      const content = response.choices[0]?.message?.content || '';
      const usage = response.usage;

      log.info({
        elapsedMs: elapsed,
        contentLength: content.length,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
        finishReason: response.choices[0]?.finish_reason,
      }, 'LLM request completed');

      return {
        content,
        success: true,
        usage: usage ? {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
        } : undefined,
      };
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const errMsg = error instanceof Error ? error.message : 'Unknown error';

      // OpenAI SDK provides structured errors
      if (error instanceof OpenAI.APIError) {
        log.error({
          status: error.status,
          code: error.code,
          type: error.type,
          message: error.message,
          elapsedMs: elapsed,
        }, 'LLM API error');
        return {
          content: '',
          success: false,
          error: `API error ${error.status}: ${error.message}`,
        };
      }

      log.error({ err: error, errorMessage: errMsg, elapsedMs: elapsed }, 'LLM request error');
      return {
        content: '',
        success: false,
        error: errMsg,
      };
    }
  }

  async chatCompletionJSON<T = unknown>(
    messages: ChatMessage[],
    parseResponse?: (content: string) => T
  ): Promise<JSONLLMResponse<T>> {
    const response = await this.chatCompletion(messages);

    if (!response.success) {
      return {
        data: null,
        success: false,
        error: response.error,
        raw: response.content,
      };
    }

    try {
      let jsonString = response.content.trim();

      // Strip markdown code blocks if present
      const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonString = jsonMatch[1].trim();
      }

      const data = parseResponse
        ? parseResponse(jsonString)
        : JSON.parse(jsonString) as T;

      return {
        data,
        success: true,
        raw: response.content,
      };
    } catch (parseError) {
      log.warn({ error: parseError, content: response.content }, 'Failed to parse JSON response');
      return {
        data: null,
        success: false,
        error: 'Failed to parse JSON response',
        raw: response.content,
      };
    }
  }

  /**
   * Chat completion with tool calling support
   */
  async chatCompletionWithTools(
    messages: ChatMessage[],
    tools: Tool[]
  ): Promise<ToolCallResponse> {
    if (!this.config.apiKey) {
      log.error('LLM API key not configured');
      return {
        content: null,
        tool_calls: null,
        success: false,
        error: 'API key not configured',
      };
    }

    const startTime = Date.now();

    try {
      const formattedMessages = this.formatMessages(messages);
      const formattedTools = tools.length > 0 ? this.formatTools(tools) : undefined;

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: formattedMessages,
        tools: formattedTools,
        tool_choice: formattedTools ? 'auto' : undefined,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      const elapsed = Date.now() - startTime;
      const message = response.choices[0]?.message;
      const finishReason = response.choices[0]?.finish_reason;

      // Convert OpenAI tool_calls to our format (filter for function type only)
      const toolCalls: ToolCall[] | null = message?.tool_calls
        ? message.tool_calls
            .filter((tc): tc is typeof tc & { type: 'function'; function: { name: string; arguments: string } } =>
              tc.type === 'function' && 'function' in tc
            )
            .map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            }))
        : null;

      log.info({
        elapsedMs: elapsed,
        hasContent: !!message?.content,
        contentPreview: message?.content?.slice(0, 100),
        toolCallCount: toolCalls?.length || 0,
        toolCallNames: toolCalls?.map(tc => tc.function.name),
        finishReason,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
      }, 'LLM tool call request completed');

      return {
        content: message?.content || null,
        tool_calls: toolCalls,
        success: true,
        finishReason: finishReason || undefined,
      };
    } catch (error) {
      const elapsed = Date.now() - startTime;

      // OpenAI SDK provides structured errors
      if (error instanceof OpenAI.APIError) {
        log.error({
          status: error.status,
          code: error.code,
          type: error.type,
          message: error.message,
          elapsedMs: elapsed,
        }, 'LLM tool call API error');
        return {
          content: null,
          tool_calls: null,
          success: false,
          error: `API error ${error.status}: ${error.message}`,
        };
      }

      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      log.error({ err: error, errorMessage: errMsg, elapsedMs: elapsed }, 'LLM tool call request error');
      return {
        content: null,
        tool_calls: null,
        success: false,
        error: errMsg,
      };
    }
  }

  async complete(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    return this.chatCompletion(messages);
  }

  async completeJSON<T = unknown>(
    prompt: string,
    systemPrompt?: string
  ): Promise<JSONLLMResponse<T>> {
    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    return this.chatCompletionJSON<T>(messages);
  }

  async analyze<T = unknown>(
    text: string,
    analysisPrompt: string,
    jsonSchema?: string
  ): Promise<JSONLLMResponse<T>> {
    const systemPrompt = `You are an AI assistant that analyzes text and returns structured JSON responses.
${jsonSchema ? `\nExpected JSON schema:\n${jsonSchema}` : ''}
Always respond with valid JSON only, no additional text.`;

    const userPrompt = `${analysisPrompt}

Text to analyze:
"${text}"`;

    return this.completeJSON<T>(userPrompt, systemPrompt);
  }
}

export function getLLMService(): LLMService {
  return LLMService.getInstance();
}

export function initLLMService(apiKey: string): LLMService {
  LLMService.resetInstance();
  return LLMService.getInstance({ apiKey });
}

export default LLMService;
