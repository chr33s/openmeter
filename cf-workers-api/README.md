# OpenMeter Cloudflare Workers API

A TypeScript implementation of OpenMeter's API using Cloudflare Workers, Workers AI, D1 database, and KV storage.

## Overview

This project provides a complete OpenMeter API implementation that runs on Cloudflare's edge infrastructure, offering:

- **High Performance**: Runs on Cloudflare's global edge network
- **AI Integration**: Leverages Workers AI with models from https://developers.cloudflare.com/llms-full.txt
- **SQL Database**: Uses Cloudflare D1 with Drizzle ORM for data persistence
- **Caching**: Implements KV-based caching for optimal performance
- **Security**: API key authentication, JWT support, rate limiting, and CORS
- **Documentation**: OpenAPI specification with interactive docs

## Features

### Core API Endpoints

- **Meters**: Create, read, update, delete metering configurations
- **Events**: Ingest single events and batch events for usage tracking
- **Subjects**: Manage entities that consume resources (users, services, etc.)
- **Features**: Configure and manage product features
- **Usage**: Query aggregated usage data with flexible time windows
- **AI Utilities**: Proxy to Workers AI with model selection
- **Health & Docs**: System health checks and API documentation

### Infrastructure Features

- **Database**: Cloudflare D1 SQL database with schema migrations
- **Caching**: KV-based caching with configurable TTLs
- **Rate Limiting**: Per-IP and per-route rate limiting
- **Authentication**: API key and JWT-based authentication
- **Logging**: Structured JSON logging with request tracing
- **Error Handling**: Comprehensive error handling and validation

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account with Workers enabled
- Wrangler CLI installed (`npm install -g wrangler`)

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Wrangler**:
   ```bash
   wrangler login
   ```

3. **Create Cloudflare resources**:
   ```bash
   # Create D1 database
   wrangler d1 create openmeter-db
   
   # Create KV namespace
   wrangler kv:namespace create "KV_CACHE"
   ```

4. **Update wrangler.toml** with the created resource IDs

5. **Set up secrets**:
   ```bash
   wrangler secret put API_KEY_SECRET
   wrangler secret put JWT_SECRET
   ```

6. **Run database migrations**:
   ```bash
   npm run db:migrate
   ```

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run typecheck
```

### Deployment

**Note:** This implementation contains ~3,400 lines of TypeScript code with comprehensive functionality. Before production deployment, resolve TypeScript type issues around Hono context variables and optional parameter handling.

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## API Documentation

Once deployed, visit `https://your-worker.your-subdomain.workers.dev/docs` for interactive API documentation.

### Authentication

The API supports two authentication methods:

1. **API Key**: Include `x-api-key` header with your API key
2. **JWT Token**: Include `Authorization: Bearer <token>` header

### Rate Limiting

- Default: 100 requests per minute per IP
- Burst: 20 requests
- Configurable via environment variables

### Caching

- List endpoints cached for 5 minutes (configurable)
- Cache automatically invalidated on write operations
- Uses Cloudflare KV for distributed caching

## Database Schema

### Tables

- `meters`: Metering configurations
- `subjects`: Resource consumers (users, services)
- `events`: Raw usage events
- `features`: Product features
- `usage_aggregates`: Pre-computed usage rollups

### Migrations

Database schema is managed through Drizzle migrations:

```bash
# Generate new migration
npm run db:generate

# Apply migrations
npm run db:migrate
```

## AI Integration

The API includes Workers AI integration with support for:

- Text completion and generation
- Model selection from Cloudflare's LLM catalog
- Configurable default models
- Error handling and fallbacks

Available at `POST /api/v1/ai/complete` with model selection.

## Configuration

Environment variables in `wrangler.toml`:

- `CORS_ORIGINS`: Allowed CORS origins (default: "*")
- `RATE_LIMIT_REQUESTS_PER_MINUTE`: Rate limit threshold
- `CACHE_TTL_SECONDS`: Cache TTL for read operations
- `DEFAULT_AI_MODEL`: Default AI model for completion

Secrets (via `wrangler secret put`):

- `API_KEY_SECRET`: Secret for API key validation
- `JWT_SECRET`: Secret for JWT token validation

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- events.test.ts
```

Tests use Miniflare for local Workers environment simulation.

## Project Structure

```
cf-workers-api/
├── src/
│   ├── index.ts              # Main application entry
│   ├── routes/               # API route handlers
│   │   ├── meters.ts
│   │   ├── events.ts
│   │   ├── subjects.ts
│   │   ├── features.ts
│   │   ├── usage.ts
│   │   └── ai.ts
│   ├── middleware/           # Request middleware
│   │   ├── auth.ts
│   │   ├── rateLimit.ts
│   │   └── validation.ts
│   ├── services/             # Business logic services
│   │   ├── database.ts
│   │   ├── cache.ts
│   │   ├── events.ts
│   │   └── ai.ts
│   ├── utils/                # Utility functions
│   │   ├── logger.ts
│   │   ├── pagination.ts
│   │   └── metrics.ts
│   └── types/                # TypeScript type definitions
│       └── index.ts
├── migrations/               # Database migrations
├── tests/                    # Test files
├── openapi.yaml             # OpenAPI specification
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

Apache 2.0 - see LICENSE file for details.