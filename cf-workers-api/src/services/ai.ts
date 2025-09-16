// AI service using Cloudflare Workers AI

import type { Env, AICompleteRequest, AICompleteResponse } from '@/types';

export class AIService {
  private ai: Ai;
  private defaultModel: string;

  constructor(ai: Ai, defaultModel: string) {
    this.ai = ai;
    this.defaultModel = defaultModel;
  }

  // Complete text using AI
  async complete(request: AICompleteRequest): Promise<AICompleteResponse> {
    const model = request.model || this.defaultModel;
    
    try {
      const response = await this.ai.run(model, {
        prompt: request.prompt,
        max_tokens: request.max_tokens || 256,
        temperature: request.temperature || 0.7,
        stream: false // KV doesn't support streaming for now
      });

      // Transform response to match our API format
      return {
        model,
        choices: [{
          text: response.response || '',
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 0, // Workers AI doesn't provide token counts
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    } catch (error) {
      console.error('AI completion error:', error);
      throw new Error(`AI completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // List available models
  async listModels(): Promise<string[]> {
    // Hardcoded list based on https://developers.cloudflare.com/llms-full.txt
    // In a real implementation, you might want to fetch this dynamically
    return [
      '@cf/meta/llama-3.1-8b-instruct',
      '@cf/meta/llama-3.1-70b-instruct',
      '@cf/meta/llama-3-8b-instruct',
      '@cf/meta/llama-3-70b-instruct',
      '@cf/microsoft/wizardlm-7b-instruct',
      '@cf/mistral/mistral-7b-instruct-v0.1',
      '@cf/qwen/qwen1.5-0.5b-chat',
      '@cf/qwen/qwen1.5-1.8b-chat',
      '@cf/qwen/qwen1.5-7b-chat-awq',
      '@cf/qwen/qwen1.5-14b-chat-awq',
      '@cf/defog/sqlcoder-7b-2',
      '@cf/thebloke/deepseek-coder-6.7b-base-awq',
      '@cf/thebloke/deepseek-coder-6.7b-instruct-awq',
      '@cf/deepseek-ai/deepseek-math-7b-base',
      '@cf/deepseek-ai/deepseek-math-7b-instruct',
      '@cf/thebloke/discolm-german-7b-v1-awq',
      '@cf/tiiuae/falcon-7b-instruct',
      '@cf/google/gemma-2b-it',
      '@cf/google/gemma-7b-it',
      '@cf/meta/llama-2-7b-chat-fp16',
      '@cf/meta/llama-2-7b-chat-int8',
      '@cf/meta/code-llama-7b-instruct-awq',
      '@cf/openchat/openchat-3.5-0106',
      '@cf/microsoft/phi-2',
      '@cf/huggingface/rocket-3b',
      '@cf/meta/llama-2-13b-chat-awq',
      '@cf/fblgit/una-cybertron-7b-v2-bf16',
      '@cf/tinyllama/tinyllama-1.1b-chat-v1.0'
    ];
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.ai.run(this.defaultModel, {
        prompt: 'Hello',
        max_tokens: 1
      });
      return !!response;
    } catch (error) {
      console.error('AI health check failed:', error);
      return false;
    }
  }
}

export function createAIService(env: Env): AIService {
  return new AIService(env.AI, env.DEFAULT_AI_MODEL);
}