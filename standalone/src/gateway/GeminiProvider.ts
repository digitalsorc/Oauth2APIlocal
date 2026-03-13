/**
 * Google Gemini Pro provider with OpenAI-compatible API translation
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GeminiAuth } from '../auth/GeminiAuth';
import { getLogger } from '../utils/logger';
import type {
  Provider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelInfo,
  ChatMessage,
} from './Provider';

export class GeminiProvider implements Provider {
  name = 'gemini';
  private auth: GeminiAuth;
  private client: GoogleGenerativeAI | null = null;

  // Available Gemini models
  private readonly MODELS = [
    'gemini-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-2.0-flash-exp',
  ];

  constructor(auth: GeminiAuth) {
    this.auth = auth;
    this.initializeClient();
  }

  private initializeClient(): void {
    const apiKey = this.auth.getAuthCredential();
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
      getLogger().debug('Gemini client initialized');
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.auth.isAuthenticated()) {
      return false;
    }
    if (!this.client) {
      this.initializeClient();
    }
    return !!this.client;
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!await this.isAvailable()) {
      return [];
    }

    return this.MODELS.map((modelId) => ({
      id: modelId,
      object: 'model' as const,
      created: Date.now(),
      owned_by: 'google',
    }));
  }

  /**
   * Convert OpenAI messages to Gemini format
   */
  private convertMessages(messages: ChatMessage[]): { systemInstruction?: string; contents: any[] } {
    let systemInstruction: string | undefined;
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Gemini uses separate systemInstruction field
        systemInstruction = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        contents.push({
          role,
          parts: [{ text }],
        });
      }
    }

    return { systemInstruction, contents };
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.client) {
      throw new Error('Gemini client not initialized');
    }

    // Extract model name (handle both "gemini-pro" and "models/gemini-pro")
    const modelName = request.model.replace(/^models\//, '');
    getLogger().debug(`Calling Gemini API: ${modelName}`);

    const model = this.client.getGenerativeModel({ model: modelName });

    const { systemInstruction, contents } = this.convertMessages(request.messages);

    try {
      const result = await model.generateContent({
        contents,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          temperature: request.temperature,
          topP: request.top_p,
          maxOutputTokens: request.max_tokens,
          stopSequences: typeof request.stop === 'string' ? [request.stop] : request.stop,
        },
      });

      const response = result.response;
      const text = response.text();

      // Count tokens (approximate)
      const promptTokens = this.estimateTokens(request.messages);
      const completionTokens = this.estimateTokens([{ role: 'assistant', content: text }]);

      return {
        id: `gemini-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: text,
            },
            finish_reason: this.mapFinishReason(response.candidates?.[0]?.finishReason),
          },
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      };
    } catch (error) {
      getLogger().error('Gemini API error', error as Error);
      throw new Error(`Gemini API error: ${(error as Error).message}`);
    }
  }

  async streamChatCompletion(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Gemini client not initialized');
    }

    const modelName = request.model.replace(/^models\//, '');
    getLogger().debug(`Streaming Gemini API: ${modelName}`);

    const model = this.client.getGenerativeModel({ model: modelName });

    const { systemInstruction, contents } = this.convertMessages(request.messages);

    try {
      const result = await model.generateContentStream({
        contents,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          temperature: request.temperature,
          topP: request.top_p,
          maxOutputTokens: request.max_tokens,
          stopSequences: typeof request.stop === 'string' ? [request.stop] : request.stop,
        },
      });

      let index = 0;
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          const sseChunk = {
            id: `gemini-${Date.now()}-${index}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: request.model,
            choices: [
              {
                index: 0,
                delta: {
                  content: text,
                },
                finish_reason: null,
              },
            ],
          };
          onChunk(`data: ${JSON.stringify(sseChunk)}\n\n`);
          index++;
        }
      }

      // Send final chunk
      const finalChunk = {
        id: `gemini-${Date.now()}-final`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      };
      onChunk(`data: ${JSON.stringify(finalChunk)}\n\n`);
      onChunk('data: [DONE]\n\n');
    } catch (error) {
      getLogger().error('Gemini streaming error', error as Error);
      throw new Error(`Gemini streaming error: ${(error as Error).message}`);
    }
  }

  /**
   * Map Gemini finish reason to OpenAI format
   */
  private mapFinishReason(reason?: string): 'stop' | 'length' | 'tool_calls' | 'content_filter' {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
      case 'RECITATION':
        return 'content_filter';
      default:
        return 'stop';
    }
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(messages: ChatMessage[]): number {
    let text = '';
    for (const msg of messages) {
      text += typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    }
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
