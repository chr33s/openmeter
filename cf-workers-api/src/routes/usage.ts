// Usage API routes (placeholder implementation)

import { Hono } from 'hono';
import type { Env } from '@/types';

const app = new Hono<{ Bindings: Env }>();

// Placeholder implementations for usage queries
app.get('/query', async (c) => {
  return c.json({ 
    message: 'Usage query API - Implementation in progress',
    description: 'Aggregate usage data by meter/subject/time window'
  });
});

app.get('/report', async (c) => {
  return c.json({ 
    message: 'Usage report API - Implementation in progress',
    description: 'Simple reporting endpoint for usage data'
  });
});

export default app;