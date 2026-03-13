/**
 * GitHub Copilot provider
 * ASSUMPTION: In standalone mode, we use GitHub's Copilot API directly
 * This requires a GitHub token with Copilot access
 * The VS Code extension uses vscode.lm API, but standalone must use REST APIs
 */

import { CopilotAuth } from '../auth/CopilotAuth';
import { getLogger } from '../utils/logger';
import type {
  Provider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelInfo,
  ChatMessage,
} from './Provider';

export class CopilotProvider implements Provider {
  name = 'copilot';
  private auth: CopilotAuth;

  // ASSUMPTION: GitHub Copilot models available via API
  // In VS Code extension, these are discovered via vscode.lm.selectChatModels()
  private readonly MODELS = [
    'gpt-4o-copilot',
    'gpt-4-copilot',
    'gpt-3.5-turbo-copilot',
    'claude-3.5-sonnet-copilot',
  ];

  constructor(auth: CopilotAuth) {
    this.auth = auth;
  }

  async isAvailable(): Promise<boolean> {
    return this.auth.isAuthenticated();
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!await this.isAvailable()) {
      return [];
    }

    return this.MODELS.map((modelId) => ({
      id: modelId,
      object: 'model' as const,
      created: Date.now(),
      owned_by: 'github-copilot',
    }));
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const token = this.auth.getToken();
    if (!token) {
      throw new Error('Copilot authentication failed: no token available');
    }

    // ASSUMPTION: GitHub Copilot API endpoint format
    // The actual endpoint may differ - this is a placeholder
    // TODO: Update with actual GitHub Copilot API endpoint once documented
    const apiUrl = 'https://api.githubcopilot.com/v1/chat/completions';

    getLogger().debug(`Calling Copilot API: ${request.model}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Editor-Version': 'standalone/1.0.0',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        top_p: request.top_p,
        max_tokens: request.max_tokens,
        stream: false,
        tools: request.tools,
        tool_choice: request.tool_choice,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      getLogger().error(`Copilot API error: ${response.status} ${errorText}`);
      throw new Error(`Copilot API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Map to OpenAI-compatible format
    return {
      id: data.id || `copilot-${Date.now()}`,
      object: 'chat.completion',
      created: data.created || Math.floor(Date.now() / 1000),
      model: request.model,
      choices: data.choices || [{
        index: 0,
        message: {
          role: 'assistant',
          content: data.content || data.message?.content || '',
          tool_calls: data.tool_calls,
        },
        finish_reason: data.finish_reason || 'stop',
      }],
      usage: data.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }

  async streamChatCompletion(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const token = this.auth.getToken();
    if (!token) {
      throw new Error('Copilot authentication failed: no token available');
    }

    const apiUrl = 'https://api.githubcopilot.com/v1/chat/completions';

    getLogger().debug(`Streaming Copilot API: ${request.model}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Editor-Version': 'standalone/1.0.0',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        top_p: request.top_p,
        max_tokens: request.max_tokens,
        stream: true,
        tools: request.tools,
        tool_choice: request.tool_choice,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      getLogger().error(`Copilot streaming error: ${response.status} ${errorText}`);
      throw new Error(`Copilot API error: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              // Forward SSE chunk in OpenAI format
              onChunk(`data: ${JSON.stringify(parsed)}\n\n`);
            } catch (e) {
              getLogger().warn(`Failed to parse SSE chunk: ${data}`);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    onChunk('data: [DONE]\n\n');
  }
}
