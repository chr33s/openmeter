// AI API routes

import { Hono } from 'hono';
import type { Env, AICompleteRequest } from '@/types';
import { AICompleteSchema } from '@/types';
import { requireAuth } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import { strictRateLimit } from '@/middleware/rateLimit';
import { withRequestLogging } from '@/utils/logger';
import { metrics } from '@/utils/metrics';
import { AIService } from '@/services/ai';

const app = new Hono<{ 
  Bindings: Env;
  Variables: { 
    aiService: AIService;
    requestId: string;
  };
}>();

// List available models
app.get('/models',
  requireAuth(),
  async (c) => {
    const logger = withRequestLogging(c.req);
    const aiService = c.get('aiService');
    
    try {
      const models = await aiService.listModels();
      
      logger.info('Listed AI models', { count: models.length });
      
      return c.json({
        models: models.map(model => ({
          id: model,
          name: model,
          description: `Cloudflare Workers AI model: ${model}`
        })),
        defaultModel: c.env.DEFAULT_AI_MODEL
      });
    } catch (error) {
      logger.error('Failed to list AI models', error as Error);
      throw error;
    }
  }
);

// Complete text using AI
app.post('/complete',
  requireAuth(),
  strictRateLimit(), // AI operations are expensive
  validate('json', AICompleteSchema),
  async (c) => {
    const logger = withRequestLogging(c.req);
    const aiService = c.get('aiService');
    const data = c.req.valid('json') as AICompleteRequest;
    
    const start = Date.now();
    const model = data.model || c.env.DEFAULT_AI_MODEL;
    
    try {
      logger.info('Starting AI completion', { 
        model, 
        promptLength: data.prompt.length,
        maxTokens: data.max_tokens,
        temperature: data.temperature
      });
      
      const result = await aiService.complete(data);
      const duration = Date.now() - start;
      
      // Record metrics
      metrics.recordAIOperation(model, duration, true);
      
      logger.info('AI completion successful', { 
        model, 
        duration,
        responseLength: result.choices[0]?.text?.length || 0
      });
      
      return c.json(result);
    } catch (error) {
      const duration = Date.now() - start;
      metrics.recordAIOperation(model, duration, false);
      
      logger.error('AI completion failed', error as Error, { 
        model,
        promptLength: data.prompt.length
      });
      
      // Return more user-friendly error for AI failures
      return c.json({
        error: {
          code: 'AI_COMPLETION_FAILED',
          message: 'AI completion request failed',
          details: {
            model,
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        },
        timestamp: new Date().toISOString(),
        requestId: c.get('requestId')
      }, 500);
    }
  }
);

// AI health check
app.get('/health',
  requireAuth(),
  async (c) => {
    const logger = withRequestLogging(c.req);
    const aiService = c.get('aiService');
    
    try {
      const isHealthy = await aiService.healthCheck();
      
      logger.info('AI health check completed', { healthy: isHealthy });
      
      return c.json({
        status: isHealthy ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        defaultModel: c.env.DEFAULT_AI_MODEL
      }, isHealthy ? 200 : 503);
    } catch (error) {
      logger.error('AI health check failed', error as Error);
      
      return c.json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 503);
    }
  }
);

export default app;