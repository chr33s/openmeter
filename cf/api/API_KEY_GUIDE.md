# API Key Management Guide

This guide explains how to use the new KV-backed API key system in the Cloudflare Worker.

## Overview

The new API key system provides:

- **Secure storage**: API keys are SHA-256 hashed, never stored in plaintext
- **Role-based access**: Keys can have "admin" or "read" roles
- **Expiration support**: Keys can be set to expire automatically
- **Usage tracking**: Last-used timestamps are maintained
- **Rate limiting**: Per-API-key rate limiting is supported

## Setup

### 1. KV Namespace Configuration

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

### 2. Environment Variables

Set the required environment variables:

```bash
# API key prefix (default: "om_")
wrangler secret put API_KEY_PREFIX

# Other required variables are already configured
```

## Creating API Keys

### Method 1: Using Admin Utilities

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

### Method 2: Initial Setup Script

```typescript
import { setupInitialApiKeys } from "#api/utils/api-key-admin";

// Sets up default admin and read keys
await setupInitialApiKeys(env);
```

## Using API Keys

### HTTP Requests

Include the API key in the `x-api-key` header:

```bash
curl -H "x-api-key: om_1234567890abcdef..." \
     -H "Content-Type: application/json" \
     https://your-worker.your-subdomain.workers.dev/api/v1/meters
```

### In Code

```typescript
const response = await fetch("/api/v1/meters", {
	headers: {
		"x-api-key": "om_1234567890abcdef...",
		"content-type": "application/json",
	},
});
```

## API Key Management

### List All Keys

```typescript
import { listApiKeys } from "#api/utils/api-key-admin";

const keys = await listApiKeys(env);
keys.forEach((key) => {
	console.log(`Key: ${key.hash.substring(0, 8)}...`);
	console.log(`Role: ${key.data.role}`);
	console.log(`Created: ${key.data.createdAt}`);
});
```

### Validate a Key

```typescript
import { getApiKeyData } from "#api/utils/api-keys";

const keyData = await getApiKeyData(env, apiKey);
if (keyData) {
	console.log("Valid key with role:", keyData.role);
} else {
	console.log("Invalid or expired key");
}
```

### Revoke a Key

```typescript
import { revokeApiKey } from "#api/utils/api-key-admin";

const success = await revokeApiKey(env, apiKey);
if (success) {
	console.log("Key revoked successfully");
}
```

## Rate Limiting

### Per-API-Key Rate Limiting

```typescript
import { perApiKeyRateLimit } from "#api/middleware/rate-limit";

// Apply per-API-key rate limiting
app.use(
	perApiKeyRateLimit({
		requestsPerMinute: 100,
		burstLimit: 20,
	}),
);
```

### Global Rate Limiting

```typescript
import { rateLimit } from "#api/middleware/rate-limit";

// Apply global rate limiting
app.use(
	rateLimit({
		requestsPerMinute: 1000,
		burstLimit: 50,
	}),
);
```

## Authentication Flow

1. **Request arrives** with `x-api-key` header
2. **Prefix validation**: Check if key starts with `env.API_KEY_PREFIX`
3. **Format validation**: Ensure key has correct format (prefix + hex)
4. **KV lookup**: Hash the key and look up `ak:{hash}` in KV_API_KEYS
5. **Expiration check**: Verify key hasn't expired
6. **Role assignment**: Set `authContext.role` from KV metadata
7. **Usage tracking**: Update `lastUsedAt` timestamp (non-blocking)

## Security Considerations

### Key Storage

- Keys are SHA-256 hashed before storage
- Storage format: `ak:{sha256_hash}` → `{role, createdAt, ...}`
- No plaintext keys are ever stored

### Key Format

- Must start with configured prefix (default: `om_`)
- Must be followed by hexadecimal characters
- Minimum length validation is enforced

### Rate Limiting

- Per-API-key limits prevent individual key abuse
- Falls back to IP-based limiting for non-API requests
- Configurable limits per endpoint

## Monitoring and Auditing

### Usage Tracking

```typescript
// Check when a key was last used
const keyData = await getApiKeyData(env, apiKey);
console.log("Last used:", keyData?.lastUsedAt);
```

### Audit All Keys

```typescript
import { auditApiKeys } from "#api/examples/api-key-management";

await auditApiKeys(env); // Logs all keys with status
```

### Cleanup Expired Keys

```typescript
import { cleanupExpiredKeys } from "#api/examples/api-key-management";

await cleanupExpiredKeys(env); // Removes expired keys
```

## Migration from Old System

The old system used a single `API_KEY_SECRET` for validation. To migrate:

1. **Create new KV namespace** for API keys
2. **Generate new keys** using the admin utilities
3. **Update clients** to use new API keys
4. **Remove** `API_KEY_SECRET` dependency

## Testing

Use the test helpers for creating temporary keys:

```typescript
import { createTestApiKey } from "#api/tests/helpers";

// Create a test admin key
const adminKey = await createTestApiKey(env, "admin", "Test admin key");

// Create a test read key
const readKey = await createTestApiKey(env, "read", "Test read key");
```

## Error Codes

- **401 Unauthorized**: Invalid, expired, or missing API key
- **403 Forbidden**: Valid key but insufficient role permissions
- **429 Rate Limited**: Too many requests for this API key

## Best Practices

1. **Use descriptive names** for API keys
2. **Set expiration dates** for temporary access
3. **Use read-only keys** when possible
4. **Regularly audit** your API keys
5. **Revoke unused keys** promptly
6. **Monitor rate limit** headers in responses
7. **Implement key rotation** for long-lived keys
