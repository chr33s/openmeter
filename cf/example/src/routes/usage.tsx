import React, { useState, useEffect } from 'react'
import { apiClient, MeterQueryResult, MeterQueryParams } from '../lib/api'
import { Card } from '../components/card'
import { Chart } from '../components/chart'
import { Table } from '../components/table'
import { LoadingState, ErrorState } from '../components/loading-error'

export function Usage() {
  const [usageData, setUsageData] = useState<MeterQueryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<MeterQueryParams>({
    meterId: 'm1',
    subjectId: 'customer-1',
    windowSize: 'DAY',
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    loadUsageData()
  }, [filters])

  const loadUsageData = async () => {
    try {
      setLoading(true)
      setError(null)

      const result = await apiClient.getUsage({
        ...filters,
        from: filters.from ? new Date(filters.from).toISOString() : undefined,
        to: filters.to ? new Date(filters.to).toISOString() : undefined,
      })

      setUsageData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage data')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: keyof MeterQueryParams, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const columns = [
    {
      key: 'windowStart',
      header: 'Start Time',
      render: (value: string) => new Date(value).toLocaleString(),
      width: '25%'
    },
    {
      key: 'windowEnd', 
      header: 'End Time',
      render: (value: string) => new Date(value).toLocaleString(),
      width: '25%'
    },
    {
      key: 'value',
      header: 'Usage Value',
      render: (value: number) => value.toLocaleString(),
      width: '20%'
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (value: string) => value || filters.subjectId || 'N/A',
      width: '30%'
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Usage Analysis</h1>
        <p className="text-gray-600">Detailed usage metrics and historical data visualization.</p>
      </div>

      {/* Filters */}
      <Card title="Filters">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meter ID
            </label>
            <input
              type="text"
              value={filters.meterId || ''}
              onChange={(e) => handleFilterChange('meterId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., m1"
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
              placeholder="e.g., customer-1"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Window Size
            </label>
            <select
              value={filters.windowSize || 'DAY'}
              onChange={(e) => handleFilterChange('windowSize', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="MINUTE">Minute</option>
              <option value="HOUR">Hour</option>
              <option value="DAY">Day</option>
              <option value="MONTH">Month</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
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
              type="date"
              value={filters.to || ''}
              onChange={(e) => handleFilterChange('to', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="mt-4 flex space-x-3">
          <button
            onClick={loadUsageData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
          >
            Apply Filters
          </button>
          <button
            onClick={() => {
              setFilters({
                meterId: 'm1',
                subjectId: 'customer-1',
                windowSize: 'DAY',
                from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                to: new Date().toISOString().split('T')[0],
              })
            }}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors duration-200"
          >
            Reset
          </button>
        </div>
      </Card>

      {error && <ErrorState error={error} onRetry={loadUsageData} />}

      {/* Chart */}
      <div>
        {loading ? (
          <LoadingState message="Loading usage chart..." />
        ) : usageData ? (
          <Chart
            data={usageData.data}
            title={`Usage Chart - ${filters.windowSize?.toLowerCase() || 'daily'} aggregation`}
            type="line"
            height={400}
          />
        ) : null}
      </div>

      {/* Data Table */}
      <div>
        <Card title="Usage Data">
          <Table
            data={usageData?.data || []}
            columns={columns}
            loading={loading}
            emptyMessage="No usage data found for the selected filters"
          />
        </Card>
      </div>

      {/* Summary Stats */}
      {usageData && usageData.data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card title="Total Usage">
            <div className="text-3xl font-bold text-blue-600">
              {usageData.data.reduce((sum, row) => sum + row.value, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Total events in selected period
            </div>
          </Card>
          
          <Card title="Average per Window">
            <div className="text-3xl font-bold text-green-600">
              {Math.round(usageData.data.reduce((sum, row) => sum + row.value, 0) / usageData.data.length).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Average events per {filters.windowSize?.toLowerCase() || 'day'}
            </div>
          </Card>
          
          <Card title="Peak Usage">
            <div className="text-3xl font-bold text-orange-600">
              {Math.max(...usageData.data.map(row => row.value)).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Highest single {filters.windowSize?.toLowerCase() || 'day'} usage
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}