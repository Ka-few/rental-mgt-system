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

import Login from './pages/Login';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { HelpProvider } from './context/HelpContext';
import PrivateRoute from './components/PrivateRoute';
import SplashScreen from './components/SplashScreen';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <HelpProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route element={<PrivateRoute />}>
                <Route path="/" element={<MainLayout />}>
                  <Route element={<PrivateRoute adminOnly={true} />}>
                    <Route index element={<Dashboard />} />
                    <Route path="properties" element={<Properties />} />
                    <Route path="mri" element={<MRIReports />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="users" element={<Users />} />
                  </Route>

                  <Route path="tenants" element={<Tenants />} />
                  <Route path="finance" element={<Finance />} />
                  <Route path="expenses" element={<Expenses />} />
                </Route>
              </Route>
            </Routes>
          </HelpProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
