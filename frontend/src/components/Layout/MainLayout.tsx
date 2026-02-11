import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PenSquare,
  CalendarDays,
  Image,
  BarChart3,
  Link2,
  Settings,
  LogOut,
  Mail,
  Sparkles,
  Link,
  Grid3X3,
  Upload,
  Tag,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/compose', icon: PenSquare, label: 'Compose' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/media', icon: Image, label: 'Media Library' },
  { to: '/inbox', icon: Mail, label: 'Inbox' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/strategy', icon: Sparkles, label: 'Strategy' },
  { to: '/categories', icon: Tag, label: 'Categories' },
  { to: '/link-in-bio', icon: Link, label: 'Link in Bio' },
  { to: '/feed-planner', icon: Grid3X3, label: 'Feed Planner' },
  { to: '/bulk-schedule', icon: Upload, label: 'Bulk Schedule' },
  { to: '/accounts', icon: Link2, label: 'Accounts' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function MainLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Social Manager</h1>
          <p className="text-sm text-gray-500 mt-1">AI-Powered</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-700">
                {user?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.full_name || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors w-full px-3 py-2 rounded-lg hover:bg-red-50"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
