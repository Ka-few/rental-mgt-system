import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import Properties from './pages/Properties';
import Finance from './pages/Finance';
import Reports from './pages/Reports';
import MRIReports from './pages/MRIReports';
import Settings from './pages/Settings';
import Expenses from './pages/Expenses';
import Users from './pages/Users';
import Maintenance from './pages/Maintenance';
import { useEffect } from 'react';

import Login from './pages/Login';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { HelpProvider } from './context/HelpContext';
import PrivateRoute from './components/PrivateRoute';
import SplashScreen from './components/SplashScreen';

import { LicenseProvider, useLicense } from './context/LicenseContext';
import Activation from './pages/Activation';
import { Navigate, Outlet } from 'react-router-dom';

const LicenseRoute = ({ restricted }) => {
  const { license } = useLicense();

  if (license.status === 'LOADING') return <div>Loading...</div>;
  if (license.status === 'EXPIRED') return <Navigate to="/activation" />;

  // If restricted feature and in trial mode, block access
  if (restricted && license.status === 'TRIAL') {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Feature Locked</h2>
        <p className="text-gray-600 mb-6">This feature is not available in the Trial version.</p>
        <a href="#/activation" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Activate Full Version</a>
      </div>
    );
  }

  return <Outlet />;
};

function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return <Root />;
}

function Root() {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <LicenseProvider>
            <HelpProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/activation" element={<Activation />} />

                <Route element={<PrivateRoute />}>
                  <Route element={<LicenseRoute />}>
                    <Route path="/" element={<MainLayout />}>
                      <Route index element={<Dashboard />} />

                      {/* Unrestricted Routes */}
                      <Route path="tenants" element={<Tenants />} />
                      <Route path="finance" element={<Finance />} />
                      <Route path="maintenance" element={<Maintenance />} />

                      {/* Restricted Routes (Admin Only) */}
                      <Route element={<PrivateRoute adminOnly={true} />}>
                        <Route path="properties" element={<Properties />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="expenses" element={<Expenses />} />

                        {/* Restricted Routes (Trial & Admin Only) */}
                        <Route element={<LicenseRoute restricted={true} />}>
                          <Route path="mri" element={<MRIReports />} />
                          <Route path="reports" element={<Reports />} />
                          <Route path="users" element={<Users />} />
                        </Route>
                      </Route>

                    </Route>
                  </Route>
                </Route>
              </Routes>
            </HelpProvider>
          </LicenseProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
