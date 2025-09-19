# OpenMeter Cloudflare Workers API

A TypeScript implementation of OpenMeter's API using Cloudflare Workers, D1 database, and KV storage.

## Overview

This project provides a complete OpenMeter API implementation that runs on Cloudflare's edge infrastructure, offering:

- **High Performance**: Runs on Cloudflare's global edge network
- **SQL Database**: Uses Cloudflare D1 with Drizzle ORM for data persistence
- **Caching**: Implements KV-based caching for optimal performance
- **Security**: KV-backed API key authentication with SHA-256 hashing, JWT support, rate limiting, and CORS
- **Documentation**: OpenAPI specification with interactive docs

## Features

### Core API Endpoints

- **Meters**: Create, read, update, delete metering configurations
- **Events**: Ingest single events and batch events for usage tracking
- **Subjects**: Manage entities that consume resources (users, services, etc.)
- **Features**: Configure and manage product features
- **Usage**: Query aggregated usage data with flexible time windows
- **Health & Docs**: System health checks and API documentation

### Infrastructure Features

- **Database**: Cloudflare D1 SQL database with schema migrations
- **Caching**: KV-based caching with configurable TTLs
- **Rate Limiting**: Per-IP and per-route rate limiting
- **Authentication**: KV-backed API key and JWT-based authentication with role-based access control
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

## API Key Management

This implementation uses a secure KV-backed API key system for authentication.

### Overview

The API key system provides:

- **Secure storage**: API keys are SHA-256 hashed, never stored in plaintext
- **Role-based access**: Keys can have "admin" or "read" roles
- **Expiration support**: Keys can be set to expire automatically
- **Usage tracking**: Last-used timestamps are maintained
- **Rate limiting**: Per-API-key rate limiting is supported

### Setup

#### 1. KV Namespace Configuration

Ensure your `wrangler.json` includes the KV_API_KEYS binding:

```json
{
	"kv_namespaces": [
		{
			"binding": "KV_CACHE",
			"id": "<uid>",
			"preview_id": "<uid>"
		},
		{
			"binding": "KV_API_KEYS",
			"id": "<uid>",
			"preview_id": "<uid>"
		}
	]
}
```

#### 2. Environment Variables

Set the required environment variables:

```bash
# API key prefix (default: "om_")
wrangler secret put API_KEY_PREFIX

# Other required variables are already configured
```

### Creating API Keys

#### Method 1: Using Admin Utilities

```typescript
import { createApiKey } from "#api/utils/api-key-admin";

// Create an admin key
const adminResult = await createApiKey(env, {
	role: "admin",
	description: "Full access admin key",
	namespace: "default",
});

// Create a read-only key with expiration
const expiryDate = new Date();
expiryDate.setMonth(expiryDate.getMonth() + 6); // 6 months

const readResult = await createApiKey(env, {
	role: "read",
	description: "Dashboard read access",
	namespace: "analytics",
	expiresAt: expiryDate,
});

console.log("Admin key:", adminResult.apiKey);
console.log("Read key:", readResult.apiKey);
```

#### Method 2: Initial Setup Script

```typescript
import { setupInitialApiKeys } from "#api/utils/api-key-admin";

// Sets up default admin and read keys
await setupInitialApiKeys(env);
```

### Using API Keys

#### HTTP Requests

Include the API key in the `x-api-key` header:

```bash
curl -H "x-api-key: om_1234567890abcdef..." \
     -H "Content-Type: application/json" \
     https://your-worker.your-subdomain.workers.dev/api/v1/meters
```

#### In Code

```typescript
const response = await fetch("/api/v1/meters", {
	headers: {
		"x-api-key": "om_1234567890abcdef...",
		"content-type": "application/json",
	},
});
```

### API Key Management

#### List All Keys

```typescript
import { listApiKeys } from "#api/utils/api-key-admin";

const keys = await listApiKeys(env);
keys.forEach((key) => {
	console.log(`Key: ${key.hash.substring(0, 8)}...`);
	console.log(`Role: ${key.data.role}`);
	console.log(`Created: ${key.data.createdAt}`);
});
```

#### Validate a Key

```typescript
import { getApiKeyData } from "#api/utils/api-keys";

const keyData = await getApiKeyData(env, apiKey);
if (keyData) {
	console.log("Valid key with role:", keyData.role);
} else {
	console.log("Invalid or expired key");
}
```

#### Revoke a Key

```typescript
import { revokeApiKey } from "#api/utils/api-key-admin";

const success = await revokeApiKey(env, apiKey);
if (success) {
	console.log("Key revoked successfully");
}
```

### Security Features

#### Key Storage

- Keys are SHA-256 hashed before storage
- Storage format: `ak:{sha256_hash}` → `{role, createdAt, ...}`
- No plaintext keys are ever stored

#### Key Format

- Must start with configured prefix (default: `om_`)
- Must be followed by hexadecimal characters
- Minimum length validation is enforced

#### Rate Limiting

- Per-API-key limits prevent individual key abuse
- Falls back to IP-based limiting for non-API requests
- Configurable limits per endpoint

### Authentication Flow

1. **Request arrives** with `x-api-key` header
2. **Prefix validation**: Check if key starts with `env.API_KEY_PREFIX`
3. **Format validation**: Ensure key has correct format (prefix + hex)
4. **KV lookup**: Hash the key and look up `ak:{hash}` in KV_API_KEYS
5. **Expiration check**: Verify key hasn't expired
6. **Role assignment**: Set `authContext.role` from KV metadata
7. **Usage tracking**: Update `lastUsedAt` timestamp (non-blocking)

### Error Codes

- **401 Unauthorized**: Invalid, expired, or missing API key
- **403 Forbidden**: Valid key but insufficient role permissions
- **429 Rate Limited**: Too many requests for this API key

### Best Practices

1. **Use descriptive names** for API keys
2. **Set expiration dates** for temporary access
3. **Use read-only keys** when possible
4. **Regularly audit** your API keys
5. **Revoke unused keys** promptly
6. **Monitor rate limit** headers in responses
7. **Implement key rotation** for long-lived keys

## API Reference

The Cloudflare Workers API provides complete parity with OpenMeter's core functionality. All endpoints use the `/api/v1` base path.

### System Endpoints

#### Health Check

- **GET** `/health` - Get service health status
  - Returns health status of database and cache services
  - Response: `200 OK` (healthy) or `503 Service Unavailable` (degraded/down)

#### Documentation

- **GET** `/docs` - Get API documentation
  - Returns interactive API documentation and endpoint information
  - Response: JSON with API structure and endpoints

#### Metrics

- **GET** `/metrics` - Get application metrics
  - Query parameters:
    - `format` (optional): `json` (default) or `prometheus`
  - Returns performance metrics, request counts, and error rates

### Meters

Meters define how to aggregate usage events for billing and analytics purposes.

#### List Meters

- **GET** `/api/v1/meters` - Get paginated list of meters
  - Query parameters:
    - `limit` (optional): Number of items (1-100, default: 20)
    - `offset` (optional): Pagination offset (default: 0)
    - `search` (optional): Search term for name/key
    - `aggregation` (optional): Filter by aggregation type
  - Response: Paginated list of meter configurations

#### Create Meter

- **POST** `/api/v1/meters` - Create new meter configuration
  - Headers: `x-api-key` or `Authorization: Bearer <token>`
  - Body: Meter configuration (name, key, aggregation, eventType, etc.)
  - Response: `201 Created` with meter details

#### Get Meter

- **GET** `/api/v1/meters/{id}` - Get specific meter by ID
  - Path parameters: `id` (UUID/ULID)
  - Response: Meter configuration details

#### Update Meter

- **PUT** `/api/v1/meters/{id}` - Update existing meter (admin only)
  - Path parameters: `id` (UUID/ULID)
  - Headers: `x-api-key` or `Authorization: Bearer <token>` (admin role required)
  - Body: Updated meter configuration
  - Response: `200 OK` with updated meter details

#### Delete Meter

- **DELETE** `/api/v1/meters/{id}` - Soft delete meter (admin only)
  - Path parameters: `id` (UUID/ULID)
  - Headers: `x-api-key` or `Authorization: Bearer <token>` (admin role required)
  - Response: `200 OK` with deletion confirmation

### Events

Events track usage of your product or service and are processed by meters.

#### Query Events

- **GET** `/api/v1/events` - Query usage events with filtering
  - Headers: `x-api-key` or `Authorization: Bearer <token>`
  - Query parameters:
    - `limit` (optional): Number of items (1-100, default: 20)
    - `offset` (optional): Pagination offset
    - `meterId` (optional): Filter by meter ID
    - `subjectId` (optional): Filter by subject ID
    - `from` (optional): Start time filter (ISO 8601)
    - `to` (optional): End time filter (ISO 8601)
  - Response: Paginated list of usage events

#### Ingest Event

- **POST** `/api/v1/events` - Ingest single usage event
  - Headers:
    - `x-api-key` or `Authorization: Bearer <token>`
    - `Idempotency-Key` (optional): For safe retries
  - Body: Event data (subject, type, timestamp, value, properties)
  - Response: `201 Created` with event ID and processing status

#### Ingest Batch Events

- **POST** `/api/v1/events/batch` - Ingest multiple events (up to 1000)
  - Headers:
    - `x-api-key` or `Authorization: Bearer <token>`
    - `Idempotency-Key` (optional): For safe retries
  - Body: Array of event data
  - Response: `201 Created` or `207 Multi-Status` with processing results

### Subjects

Subjects are entities that consume resources you wish to meter (users, services, devices).

#### List Subjects

- **GET** `/api/v1/subjects` - Get paginated list of subjects
  - Query parameters: `limit`, `offset`, `search`
  - Response: Paginated list of subjects

#### Create Subject

- **POST** `/api/v1/subjects` - Create new subject
  - Headers: `x-api-key` or `Authorization: Bearer <token>`
  - Body: Subject data (key, displayName, metadata)
  - Response: `201 Created` with subject details

#### Get Subject

- **GET** `/api/v1/subjects/{id}` - Get specific subject by ID
  - Path parameters: `id` (UUID/ULID)
  - Response: Subject details

#### Update Subject

- **PUT** `/api/v1/subjects/{id}` - Update existing subject
  - Path parameters: `id` (UUID/ULID)
  - Headers: `x-api-key` or `Authorization: Bearer <token>`
  - Body: Updated subject data
  - Response: `200 OK` with updated subject details

#### Delete Subject

- **DELETE** `/api/v1/subjects/{id}` - Delete subject
  - Path parameters: `id` (UUID/ULID)
  - Headers: `x-api-key` or `Authorization: Bearer <token>`
  - Response: `200 OK` with deletion confirmation

### Features

Features represent product capabilities that can be linked to meters for usage tracking.

#### List Features

- **GET** `/api/v1/features` - Get list of features
  - Query parameters: `limit`, `offset`, `search`
  - Response: Paginated list of features

#### Create Feature

- **POST** `/api/v1/features` - Create new feature
  - Headers: `x-api-key` or `Authorization: Bearer <token>`
  - Body: Feature data (key, name, description, meterId)
  - Response: `201 Created` with feature details

#### Get Feature

- **GET** `/api/v1/features/{id}` - Get specific feature by ID
  - Path parameters: `id` (UUID/ULID)
  - Response: Feature details

#### Update Feature

- **PUT** `/api/v1/features/{id}` - Update existing feature
  - Path parameters: `id` (UUID/ULID)
  - Headers: `x-api-key` or `Authorization: Bearer <token>`
  - Body: Updated feature data
  - Response: `200 OK` with updated feature details

#### Delete Feature

- **DELETE** `/api/v1/features/{id}` - Delete feature
  - Path parameters: `id` (UUID/ULID)
  - Headers: `x-api-key` or `Authorization: Bearer <token>`
  - Response: `200 OK` with deletion confirmation

### Usage Analytics

Query aggregated usage data with flexible time windows and aggregation methods.

#### Usage Query

- **GET** `/api/v1/usage/query` - Aggregate usage data
  - Headers: `x-api-key` or `Authorization: Bearer <token>`
  - Query parameters:
    - `meterId` (optional): Filter by meter
    - `subjectId` (optional): Filter by subject
    - `from` (required): Start time (ISO 8601)
    - `to` (required): End time (ISO 8601)
    - `windowSize` (optional): Time window (MINUTE, HOUR, DAY, MONTH)
    - `groupBy` (optional): Grouping dimensions
  - Response: Aggregated usage data with SUM, COUNT, MAX, etc.

#### Usage Report

- **GET** `/api/v1/usage/report` - Simple usage reporting
  - Headers: `x-api-key` or `Authorization: Bearer <token>`
  - Query parameters: Similar to usage query
  - Response: Simplified usage report format
