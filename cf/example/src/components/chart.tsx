import React, { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  TimeScale,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import 'chartjs-adapter-luxon'
import { Bar, Line } from 'react-chartjs-2'
import type { MeterQueryRow } from '../lib/api'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  TimeScale,
  Title,
  Tooltip,
  Legend
)

interface ChartProps {
  data: MeterQueryRow[]
  title?: string
  type?: 'bar' | 'line'
  height?: number
  loading?: boolean
  className?: string
}

export function Chart({ 
  data, 
  title = 'Usage Chart', 
  type = 'bar', 
  height = 300,
  loading = false,
  className = ''
}: ChartProps) {
  const chartRef = useRef<any>()

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
      }
    }
  }, [])

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`} style={{ height: height + 50 }}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-blue-600 rounded-full" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <span className="ml-2 text-gray-500">Loading chart...</span>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`} style={{ height: height + 50 }}>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-full text-gray-500">
          No data available for chart
        </div>
      </div>
    )
  }

  const chartData = {
    labels: data.map(row => {
      const date = new Date(row.windowStart)
      return date.toLocaleDateString()
    }),
    datasets: [
      {
        label: 'Usage',
        data: data.map(row => ({
          x: row.windowStart,
          y: row.value,
        })),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        tension: 0.4,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: 'day' as const,
        },
        adapters: {
          date: {
            zone: 'UTC',
          },
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return typeof value === 'number' ? value.toLocaleString() : value
          }
        }
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  }

  const ChartComponent = type === 'line' ? Line : Bar

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      <div style={{ height }}>
        <ChartComponent ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  )
}