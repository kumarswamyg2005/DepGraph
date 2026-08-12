import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Home } from './pages/Home';
import { PackageExplorer } from './pages/PackageExplorer';
import { BusFactor } from './pages/BusFactor';
import { BlastRadius } from './pages/BlastRadius';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex" style={{ minHeight: '100vh' }}>
        <Sidebar />
        <main className="flex-1 overflow-auto" style={{ background: '#0a0a0f' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/packages" element={<PackageExplorer />} />
            <Route path="/bus-factor" element={<BusFactor />} />
            <Route path="/blast-radius" element={<BlastRadius />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
