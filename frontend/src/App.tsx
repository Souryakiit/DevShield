import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Overview from './pages/Overview';
import Findings from './pages/Findings';
import FileDetail from './pages/FileDetail';
import Search from './pages/Search';
import ApproveBaseline from './pages/ApproveBaseline';
import { USE_MOCKS } from './config';

export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar />
        <div className="main-content">
          {USE_MOCKS && (
            <div className="demo-banner">
              Demo data — run locally for live scanning · <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>.\scripts\run-all.ps1</code>
            </div>
          )}
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/findings" element={<Findings />} />
            <Route path="/file/:id" element={<FileDetail />} />
            <Route path="/search" element={<Search />} />
            <Route path="/baseline" element={<ApproveBaseline />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
