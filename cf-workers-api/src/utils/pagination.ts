// Pagination utilities

import type { PaginationParams, PaginationResponse } from '@/types';

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
  defaultOffset?: number;
}

export class Pagination {
  private options: Required<PaginationOptions>;

  constructor(options: PaginationOptions = {}) {
    this.options = {
      defaultLimit: options.defaultLimit || 20,
      maxLimit: options.maxLimit || 100,
      defaultOffset: options.defaultOffset || 0
    };
  }

  // Parse pagination parameters from URL search params
  parseParams(searchParams: URLSearchParams): PaginationParams {
    const limit = this.parseLimit(searchParams.get('limit'));
    const offset = this.parseOffset(searchParams.get('offset'));
    const page = this.parsePage(searchParams.get('page'));
    const after = searchParams.get('after') || undefined;

    // If page is provided, calculate offset
    if (page !== undefined && offset === this.options.defaultOffset) {
      return {
        limit,
        offset: (page - 1) * limit,
        page,
        after
      };
    }

    return {
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      after
    };
  }

  // Create pagination response
  createResponse<T>(
    data: T[],
    params: PaginationParams,
    totalCount: number
  ): PaginationResponse<T> {
    const { limit, offset, page } = params;
    const hasNextPage = offset + limit < totalCount;
    const hasPreviousPage = offset > 0;

    return {
      data,
      totalCount,
      hasNextPage,
      hasPreviousPage,
      page,
      limit,
      offset
    };
  }

  // Create pagination links for headers
  createLinks(
    baseUrl: string,
    params: PaginationParams,
    totalCount: number
  ): Record<string, string> {
    const links: Record<string, string> = {};
    const { limit, offset } = params;

    // First page
    if (offset > 0) {
      links.first = this.buildUrl(baseUrl, { ...params, offset: 0 });
    }

    // Previous page
    if (offset > 0) {
      const prevOffset = Math.max(0, offset - limit);
      links.prev = this.buildUrl(baseUrl, { ...params, offset: prevOffset });
    }

    // Next page
    if (offset + limit < totalCount) {
      const nextOffset = offset + limit;
      links.next = this.buildUrl(baseUrl, { ...params, offset: nextOffset });
    }

    // Last page
    if (offset + limit < totalCount) {
      const lastOffset = Math.floor((totalCount - 1) / limit) * limit;
      links.last = this.buildUrl(baseUrl, { ...params, offset: lastOffset });
    }

    return links;
  }

  // Build URL with pagination parameters
  private buildUrl(baseUrl: string, params: PaginationParams): string {
    const url = new URL(baseUrl);
    
    if (params.limit !== this.options.defaultLimit) {
      url.searchParams.set('limit', params.limit.toString());
    }
    
    if (params.offset !== this.options.defaultOffset) {
      url.searchParams.set('offset', params.offset.toString());
    }
    
    if (params.after) {
      url.searchParams.set('after', params.after);
    }

    return url.toString();
  }

  // Parse limit parameter
  private parseLimit(value: string | null): number {
    if (!value) return this.options.defaultLimit;
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 1) {
      return this.options.defaultLimit;
    }
    
    return Math.min(parsed, this.options.maxLimit);
  }

  // Parse offset parameter
  private parseOffset(value: string | null): number {
    if (!value) return this.options.defaultOffset;
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) {
      return this.options.defaultOffset;
    }
    
    return parsed;
  }

  // Parse page parameter
  private parsePage(value: string | null): number | undefined {
    if (!value) return undefined;
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 1) {
      return undefined;
    }
    
    return parsed;
  }
}

// Default pagination instance
export const pagination = new Pagination();

// Helper function to add Link header to response
export function addPaginationHeaders(
  response: Response,
  baseUrl: string,
  params: PaginationParams,
  totalCount: number
): Response {
  const links = pagination.createLinks(baseUrl, params, totalCount);
  
  if (Object.keys(links).length > 0) {
    const linkHeader = Object.entries(links)
      .map(([rel, url]) => `<${url}>; rel="${rel}"`)
      .join(', ');
    
    response.headers.set('Link', linkHeader);
  }
  
  response.headers.set('X-Total-Count', totalCount.toString());
  response.headers.set('X-Page', (params.page || 1).toString());
  response.headers.set('X-Per-Page', params.limit.toString());
  
  return response;
}