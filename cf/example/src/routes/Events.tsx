import React, { useState, useEffect } from 'react'
import { apiClient, Event, EventsQueryParams, PaginationResponse } from '../lib/api'
import { Card } from '../components/Card'
import { Table, Pagination } from '../components/Table'
import { LoadingState, ErrorState, EmptyState } from '../components/LoadingError'

export function Events() {
  const [events, setEvents] = useState<PaginationResponse<Event> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<EventsQueryParams>({
    page: 1,
    pageSize: 25,
    meterId: '',
    subjectId: '',
    from: '',
    to: '',
  })

  useEffect(() => {
    loadEvents()
  }, [currentPage])

  const loadEvents = async () => {
    try {
      setLoading(true)
      setError(null)

      const queryParams = {
        ...filters,
        page: currentPage,
        from: filters.from ? new Date(filters.from).toISOString() : undefined,
        to: filters.to ? new Date(filters.to).toISOString() : undefined,
      }

      // Remove empty string values
      Object.keys(queryParams).forEach(key => {
        if (queryParams[key as keyof typeof queryParams] === '') {
          delete queryParams[key as keyof typeof queryParams]
        }
      })

      const result = await apiClient.getEvents(queryParams)
      setEvents(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: keyof EventsQueryParams, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const applyFilters = () => {
    setCurrentPage(1)
    loadEvents()
  }

  const resetFilters = () => {
    setFilters({
      page: 1,
      pageSize: 25,
      meterId: '',
      subjectId: '',
      from: '',
      to: '',
    })
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const columns = [
    {
      key: 'id',
      header: 'Event ID',
      render: (value: string) => (
        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
          {value.length > 12 ? `${value.slice(0, 12)}...` : value}
        </code>
      ),
      width: '15%'
    },
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (value: string) => new Date(value).toLocaleString(),
      width: '20%'
    },
    {
      key: 'subjectId',
      header: 'Subject',
      width: '15%'
    },
    {
      key: 'meterId',
      header: 'Meter',
      width: '15%'
    },
    {
      key: 'value',
      header: 'Value',
      render: (value?: number) => value !== undefined ? value.toLocaleString() : 'N/A',
      width: '10%'
    },
    {
      key: 'properties',
      header: 'Properties',
      render: (value?: Record<string, any>) => {
        if (!value || Object.keys(value).length === 0) return 'None'
        return (
          <details className="cursor-pointer">
            <summary className="text-blue-600 hover:text-blue-800">
              {Object.keys(value).length} properties
            </summary>
            <pre className="text-xs mt-2 bg-gray-100 p-2 rounded max-w-xs overflow-auto">
              {JSON.stringify(value, null, 2)}
            </pre>
          </details>
        )
      },
      width: '25%'
    }
  ]

  const totalPages = events ? Math.ceil(events.totalCount / (filters.pageSize || 25)) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Events</h1>
        <p className="text-gray-600">View and filter all events sent to OpenMeter.</p>
      </div>

      {/* Filters */}
      <Card title="Filters">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meter ID
            </label>
            <input
              type="text"
              value={filters.meterId || ''}
              onChange={(e) => handleFilterChange('meterId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Filter by meter ID"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject ID
            </label>
            <input
              type="text"
              value={filters.subjectId || ''}
              onChange={(e) => handleFilterChange('subjectId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Filter by subject ID"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="datetime-local"
              value={filters.from || ''}
              onChange={(e) => handleFilterChange('from', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="datetime-local"
              value={filters.to || ''}
              onChange={(e) => handleFilterChange('to', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Page Size
            </label>
            <select
              value={filters.pageSize || 25}
              onChange={(e) => handleFilterChange('pageSize', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex space-x-3">
          <button
            onClick={applyFilters}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
          >
            Apply Filters
          </button>
          <button
            onClick={resetFilters}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors duration-200"
          >
            Reset
          </button>
          <button
            onClick={loadEvents}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors duration-200"
          >
            Refresh
          </button>
        </div>
      </Card>

      {error && <ErrorState error={error} onRetry={loadEvents} />}

      {/* Events Table */}
      <div>
        {loading ? (
          <LoadingState message="Loading events..." />
        ) : events && events.data.length > 0 ? (
          <div className="space-y-4">
            <Card title={`Events (${events.totalCount.toLocaleString()} total)`}>
              <Table
                data={events.data}
                columns={columns}
                emptyMessage="No events found for the selected filters"
              />
            </Card>
            
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                hasNextPage={events.hasNextPage}
                hasPreviousPage={events.hasPreviousPage}
              />
            )}
          </div>
        ) : (
          <Card>
            <EmptyState
              title="No Events Found"
              message="No events match your current filters. Try adjusting the filters or check if events are being sent to OpenMeter."
              action={
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                >
                  Clear Filters
                </button>
              }
            />
          </Card>
        )}
      </div>

      {/* Summary */}
      {events && events.data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Total Events">
            <div className="text-2xl font-bold text-blue-600">
              {events.totalCount.toLocaleString()}
            </div>
          </Card>
          
          <Card title="Current Page">
            <div className="text-2xl font-bold text-green-600">
              {currentPage} / {totalPages}
            </div>
          </Card>
          
          <Card title="Showing">
            <div className="text-2xl font-bold text-orange-600">
              {events.data.length}
            </div>
          </Card>
          
          <Card title="Page Size">
            <div className="text-2xl font-bold text-purple-600">
              {filters.pageSize || 25}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}