import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Landing from './pages/Landing';
import Overview from './pages/Overview';
import Findings from './pages/Findings';
import FileDetail from './pages/FileDetail';
import Search from './pages/Search';
import ApproveBaseline from './pages/ApproveBaseline';
import NotFound from './pages/NotFound';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import { USE_MOCKS } from './config';

const APP_ROUTES = ['/scan', '/findings', '/file', '/search', '/baseline'];

function AppShell() {
  const { pathname } = useLocation();
  const isApp = APP_ROUTES.some(r => pathname.startsWith(r));

  if (!isApp) {
    return (
      <Routes>
        <Route path="/tos"     element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="*"        element={<NotFound />} />
      </Routes>
    );
  }

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        {USE_MOCKS && (
          <div className="demo-banner">
            Demo data — run locally for live scanning · <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>./scripts/run-all.sh</code>
          </div>
        )}
        <Routes>
          <Route path="/scan"     element={<Overview />} />
          <Route path="/findings" element={<Findings />} />
          <Route path="/file/:id" element={<FileDetail />} />
          <Route path="/search"   element={<Search />} />
          <Route path="/baseline" element={<ApproveBaseline />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"  element={<Landing />} />
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  );
}
