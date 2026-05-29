import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import FarmPage from './pages/FarmPage';
import MapPage from './pages/MapPage';
import HiveDetailPage from './pages/HiveDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FarmPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/hive/:id" element={<HiveDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}
