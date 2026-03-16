import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { InspectionPage, AgentPage, HistoryPage, AssetsPage, SettingsPage } from './pages';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<InspectionPage />} />
        <Route path="inspection/agent" element={<AgentPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
