import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { getMe } from './api/auth';
import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Compose from './pages/Compose';
import Calendar from './pages/Calendar';
import MediaLibrary from './pages/MediaLibrary';
import Analytics from './pages/Analytics';
import Accounts from './pages/Accounts';
import Settings from './pages/Settings';
import Inbox from './pages/Inbox';
import Strategy from './pages/Strategy';
import LinkInBio from './pages/LinkInBio';
import FeedPlanner from './pages/FeedPlanner';
import BulkSchedule from './pages/BulkSchedule';
import Categories from './pages/Categories';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppContent() {
  const { isAuthenticated, setUser } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      getMe().then(setUser).catch(() => {});
    }
  }, [isAuthenticated, setUser]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <AuthGuard>
            <MainLayout />
          </AuthGuard>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/compose" element={<Compose />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/media" element={<MediaLibrary />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/strategy" element={<Strategy />} />
        <Route path="/link-in-bio" element={<LinkInBio />} />
        <Route path="/feed-planner" element={<FeedPlanner />} />
        <Route path="/bulk-schedule" element={<BulkSchedule />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
