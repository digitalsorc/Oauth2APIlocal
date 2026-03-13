/**
 * ProviderRouter - Routes requests to the correct provider based on model name
 */

import { getLogger } from '../utils/logger';
import type { Provider, ChatCompletionRequest, ChatCompletionResponse, ModelInfo } from './Provider';

export class ProviderRouter {
  private providers: Map<string, Provider> = new Map();

  // Model prefix to provider mapping
  private readonly MODEL_PREFIX_MAP: Record<string, string> = {
    'gpt-': 'copilot',
    'gpt4': 'copilot',
    'claude-': 'copilot',
    'gemini-': 'gemini',
    'gemini': 'gemini',
    'models/gemini': 'gemini',
  };

  registerProvider(provider: Provider): void {
    this.providers.set(provider.name, provider);
    getLogger().info(`Registered provider: ${provider.name}`);
  }

  /**
   * Route model request to appropriate provider
   */
  private getProviderForModel(model: string): Provider {
    // Check exact match first
    if (this.providers.has(model)) {
      return this.providers.get(model)!;
    }

    // Check prefix matches
    for (const [prefix, providerName] of Object.entries(this.MODEL_PREFIX_MAP)) {
      if (model.toLowerCase().startsWith(prefix.toLowerCase())) {
        const provider = this.providers.get(providerName);
        if (provider) {
          return provider;
        }
      }
    }

    // Default to first available provider
    const firstProvider = Array.from(this.providers.values())[0];
    if (!firstProvider) {
      throw new Error('No providers available');
    }

    getLogger().warn(`No provider found for model '${model}', using default: ${firstProvider.name}`);
    return firstProvider;
  }

  async listAllModels(): Promise<ModelInfo[]> {
    const allModels: ModelInfo[] = [];

    for (const provider of this.providers.values()) {
      try {
        if (await provider.isAvailable()) {
          const models = await provider.listModels();
          allModels.push(...models);
        }
      } catch (error) {
        getLogger().error(`Failed to list models from ${provider.name}`, error as Error);
      }
    }

    return allModels;
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const provider = this.getProviderForModel(request.model);

    if (!await provider.isAvailable()) {
      throw new Error(`Provider ${provider.name} is not available`);
    }

    getLogger().debug(`Routing model '${request.model}' to provider '${provider.name}'`);
    return provider.chatCompletion(request);
  }

  async streamChatCompletion(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const provider = this.getProviderForModel(request.model);

    if (!await provider.isAvailable()) {
      throw new Error(`Provider ${provider.name} is not available`);
    }

    getLogger().debug(`Streaming model '${request.model}' via provider '${provider.name}'`);
    return provider.streamChatCompletion(request, onChunk);
  }

  getProvider(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  getAllProviders(): Provider[] {
    return Array.from(this.providers.values());
  }
}
