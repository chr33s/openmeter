# OpenMeter Customer Dashboard - Cloudflare Example

A customer dashboard example built with Vite + React + TypeScript and react-router@7, designed to work with Cloudflare Pages. This example demonstrates how to build a customer-facing dashboard that integrates with the OpenMeter API endpoints.

## Features

- **Modern Stack**: Built with Vite, React 18, TypeScript, and react-router@7
- **Cloudflare Ready**: Configured for deployment to Cloudflare Pages
- **API Integration**: Uses native fetch calls to OpenMeter API endpoints (no SDK dependency)
- **Responsive UI**: Clean interface built with Tailwind CSS
- **Code Quality**: Uses oxlint and Prettier with @prettier/plugin-oxc (no ESLint)

## Pages

- **Dashboard** (`/`) - Overview with usage metrics and charts
- **Usage** (`/usage`) - Detailed usage analysis with filtering
- **Events** (`/events`) - Event listing with pagination and search
- **Entitlements** (`/entitlements`) - Customer entitlements and limits
- **Plans** (`/plans`) - Available subscription plans

## Prerequisites

- Node.js 20+
- npm or pnpm
- OpenMeter API running locally or accessible endpoint

## Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Start the development server:**

   ```bash
   npm run dev
   ```

3. **Access the application:**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Format code
npm run format

# Check formatting
npm run format:check

# Lint code
npm run lint

# Type check
npm run typecheck
```

## API Integration

The application expects OpenMeter API endpoints to be available at `/api/v1/`. The current configuration assumes:

- **Base URL**: Same origin (relative API calls)
- **Available endpoints**:
  - `GET /api/v1/usage/query` - Usage data
  - `GET /api/v1/usage/report` - Usage reports
  - `GET /api/v1/events` - Events listing
  - `GET /api/v1/meters` - Meters management
  - `GET /api/v1/subjects` - Subjects management

### Local Development with API

If running locally without the full OpenMeter API available, you can:

1. **Proxy to existing OpenMeter instance:**
   Add to `vite.config.ts`:

   ```typescript
   server: {
     proxy: {
       '/api': 'http://localhost:8888'
     }
   }
   ```

2. **Use the Cloudflare Worker API:** Ensure the CF API worker is running and accessible.

3. **Mock responses:** The application includes graceful error handling and placeholder content for unavailable endpoints.

## Configuration

### Default Settings

- **Meter ID**: `m1`
- **Subject ID**: `customer-1`
- **Window Size**: `DAY`
- **Date Range**: Last 30 days

## Deployment

### Cloudflare Pages

1. **Build the application:**

   ```bash
   npm run build
   ```

2. **Deploy to Cloudflare Pages:**
   - Connect your GitHub repository to Cloudflare Pages
   - Set build command: `npm run build`
   - Set output directory: `dist`

## Architecture

### Components

- **`Card.tsx`** - Reusable card and metric card components
- **`Table.tsx`** - Data table with pagination support
- **`Chart.tsx`** - Chart component using Chart.js
- **`Navigation.tsx`** - Sidebar navigation and header
- **`LoadingError.tsx`** - Loading, error, and empty state components

### API Client

- **`api.ts`** - Centralized API client using native fetch
- Type-safe interfaces for all API responses
- Built-in error handling and loading states
- AbortController support for request cancellation

## License

This example is part of the OpenMeter project and follows the same license terms.
