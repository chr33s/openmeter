import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Navigation, Header } from './components/Navigation'
import { Dashboard } from './routes/Dashboard'
import { Usage } from './routes/Usage'
import { Events } from './routes/Events'
import { Entitlements } from './routes/Entitlements'
import { Plans } from './routes/Plans'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-green-100">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <Navigation />
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/usage" element={<Usage />} />
              <Route path="/events" element={<Events />} />
              <Route path="/entitlements" element={<Entitlements />} />
              <Route path="/plans" element={<Plans />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}

export default App
