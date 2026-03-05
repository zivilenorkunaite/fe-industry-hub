import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Zap, Wrench, BookOpen, PlusCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { Home } from './pages/Home';
import { Tools } from './pages/Tools';
import { Stories } from './pages/Stories';
import { Submit } from './pages/Submit';
import { Admin } from './pages/Admin';

function Layout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-db-grey-light flex items-center justify-center">
        <div className="text-db-grey-mid">Loading...</div>
      </div>
    );
  }

  const navItems = [
    { to: '/', label: 'Home', icon: Zap, exact: true },
    { to: '/tools', label: 'Tools & Systems', icon: Wrench },
    { to: '/stories', label: 'Customer Stories', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="bg-db-navy text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-db-red rounded flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-sm tracking-wide">ANZ Energy Hub</span>
            </div>

            {/* Nav links */}
            <nav className="flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                      isActive
                        ? 'bg-white/15 text-white font-medium'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </NavLink>
              ))}

              {user && (user.role === 'contributor' || user.role === 'admin') && (
                <NavLink
                  to="/submit"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                      isActive
                        ? 'bg-db-red text-white font-medium'
                        : 'text-white/70 hover:text-white hover:bg-db-red/80'
                    }`
                  }
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Submit
                </NavLink>
              )}

              {user && user.role === 'admin' && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                      isActive
                        ? 'bg-white/15 text-white font-medium'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin
                </NavLink>
              )}
            </nav>

            {/* User chip */}
            {user && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/70">{user.display_name}</span>
                <span className="bg-db-red/80 text-white text-xs px-2 py-0.5 rounded-full capitalize">
                  {user.role}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/tools" element={<Tools user={user} />} />
          <Route path="/stories" element={<Stories user={user} />} />
          <Route
            path="/submit"
            element={
              user && (user.role === 'contributor' || user.role === 'admin')
                ? <Submit user={user} />
                : <Navigate to="/" replace />
            }
          />
          <Route
            path="/admin"
            element={
              user && user.role === 'admin'
                ? <Admin />
                : <Navigate to="/" replace />
            }
          />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-db-navy text-white/50 text-xs text-center py-3">
        FE ANZ Energy &amp; Utilities · Databricks Internal
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
