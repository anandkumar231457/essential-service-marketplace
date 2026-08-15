import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { ServiceCategory } from '../types';

const iconMap: Record<string, string> = {
  zap: '⚡',
  droplet: '💧',
  tool: '🔧',
  sparkles: '✨',
  hammer: '🔨',
  wind: '❄️',
  settings: '🔩',
  wrench: '🛠️',
  'help-circle': '❓',
};

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const { data, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ categories: ServiceCategory[] }>('/api/categories'),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-600">Essential Services</h1>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-gray-600">
                Hi, {user.name} ({user.role})
              </span>
            )}
            <button
              onClick={logout}
              className="text-sm text-red-600 hover:underline"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">What do you need help with?</h2>

        {isLoading && <p className="text-gray-500">Loading categories…</p>}
        {error && <p className="text-red-600">{(error as Error).message}</p>}

        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/providers?category=${encodeURIComponent(cat.name)}`}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition text-center"
              >
                <div className="text-4xl mb-2">{iconMap[cat.icon] ?? '❓'}</div>
                <div className="font-semibold text-gray-800">{cat.name}</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}