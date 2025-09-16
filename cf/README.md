# OpenMeter Cloudflare Workers API

A TypeScript implementation of OpenMeter's API using Cloudflare Workers, D1 database, and KV storage.

## Overview

This project provides a complete OpenMeter API implementation that runs on Cloudflare's edge infrastructure, offering:

- **High Performance**: Runs on Cloudflare's global edge network
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

