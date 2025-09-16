// Basic tests for the API endpoints

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare } from 'miniflare';

let mf: Miniflare;

beforeAll(async () => {
  // Initialize Miniflare for testing
  mf = new Miniflare({
    // Point to the built worker
    scriptPath: './dist/index.js',
    // Simulate environment variables
    bindings: {
      ENVIRONMENT: 'test',
      CORS_ORIGINS: '*',
      API_KEY_PREFIX: 'om_',
      JWT_ISSUER: 'openmeter',
      JWT_AUDIENCE: 'openmeter-api',
      RATE_LIMIT_REQUESTS_PER_MINUTE: '1000',
      RATE_LIMIT_BURST: '100',
      CACHE_TTL_SECONDS: '300',
      IDEMPOTENCY_TTL_HOURS: '24',
      DEFAULT_AI_MODEL: '@cf/meta/llama-3.1-8b-instruct',
      API_KEY_SECRET: 'test-secret',
      JWT_SECRET: 'test-jwt-secret'
    },
    // Simulate D1 database
    d1Databases: {
      D1_DB: {}
    },
    // Simulate KV namespace
    kvNamespaces: {
      KV_CACHE: {}
    },
    // Note: AI binding simulation is limited in Miniflare
    modules: true,
    compatibilityDate: '2024-01-15'
  });
});

afterAll(async () => {
  await mf.dispose();
});

describe('Health Check', () => {
  test('GET /health returns health status', async () => {
    const response = await mf.dispatchFetch('http://localhost/health');
    expect(response.status).toBe(503); // Expected to be degraded/down in test environment
    
    const json = await response.json();
    expect(json).toHaveProperty('status');
    expect(json).toHaveProperty('timestamp');
    expect(json).toHaveProperty('checks');
    expect(json).toHaveProperty('version');
  });
});

describe('Documentation', () => {
  test('GET /docs returns API documentation', async () => {
    const response = await mf.dispatchFetch('http://localhost/docs');
    expect(response.status).toBe(200);
    
    const json = await response.json();
    expect(json).toHaveProperty('name');
    expect(json).toHaveProperty('version');
    expect(json).toHaveProperty('endpoints');
  });
});

describe('Metrics', () => {
  test('GET /metrics returns metrics in JSON format', async () => {
    const response = await mf.dispatchFetch('http://localhost/metrics');
    expect(response.status).toBe(200);
    
    const json = await response.json();
    expect(json).toHaveProperty('timestamp');
  });

  test('GET /metrics?format=prometheus returns Prometheus format', async () => {
    const response = await mf.dispatchFetch('http://localhost/metrics?format=prometheus');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
  });
});

describe('CORS', () => {
  test('OPTIONS request returns CORS headers', async () => {
    const response = await mf.dispatchFetch('http://localhost/api/v1/meters', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET'
      }
    });
    
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toContain('GET');
  });
});

describe('Authentication', () => {
  test('Unauthenticated request to protected endpoint returns 401', async () => {
    const response = await mf.dispatchFetch('http://localhost/api/v1/meters');
    expect(response.status).toBe(401);
    
    const json = await response.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  test('Request with invalid API key returns 401', async () => {
    const response = await mf.dispatchFetch('http://localhost/api/v1/meters', {
      headers: {
        'x-api-key': 'invalid-key'
      }
    });
    expect(response.status).toBe(401);
  });
});

describe('Rate Limiting', () => {
  test('Response includes rate limit headers', async () => {
    const response = await mf.dispatchFetch('http://localhost/api/v1/meters');
    
    // Check for rate limit headers (even if request fails due to auth)
    expect(response.headers.get('x-ratelimit-limit')).toBeTruthy();
    expect(response.headers.get('x-ratelimit-remaining')).toBeTruthy();
    expect(response.headers.get('x-ratelimit-reset')).toBeTruthy();
  });
});

describe('Error Handling', () => {
  test('404 for non-existent endpoint', async () => {
    const response = await mf.dispatchFetch('http://localhost/non-existent');
    expect(response.status).toBe(404);
    
    const json = await response.json();
    expect(json.error.code).toBe('NOT_FOUND');
    expect(json).toHaveProperty('requestId');
    expect(json).toHaveProperty('timestamp');
  });
});

describe('Request Validation', () => {
  test('POST with invalid content type returns 400', async () => {
    const response = await mf.dispatchFetch('http://localhost/api/v1/events', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        'x-api-key': 'test-key'
      },
      body: 'invalid data'
    });
    
    expect(response.status).toBe(400);
    
    const json = await response.json();
    expect(json.error.code).toBe('INVALID_CONTENT_TYPE');
  });
});

describe('AI Endpoints', () => {
  test('GET /api/v1/ai/models requires authentication', async () => {
    const response = await mf.dispatchFetch('http://localhost/api/v1/ai/models');
    expect(response.status).toBe(401);
  });
});

// Note: More comprehensive tests would require:
// 1. Proper D1 database setup with migrations
// 2. Valid API keys for authentication
// 3. Mocked AI service responses
// 4. Integration tests with real data flow
// 
// This test suite provides basic smoke tests for the API structure.