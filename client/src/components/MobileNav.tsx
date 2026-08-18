import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function MobileNav() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
      <div className="flex justify-around items-center py-2 px-2">
        <Link
          to="/"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition ${
            isActive('/') ? 'text-primary font-bold' : 'text-slate-500'
          }`}
        >
          <span className="text-base">🏠</span>
          <span>Explore</span>
        </Link>

        <Link
          to="/providers"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition ${
            isActive('/providers') ? 'text-primary font-bold' : 'text-slate-500'
          }`}
        >
          <span className="text-base">🔍</span>
          <span>Find Pros</span>
        </Link>

        {user && (
          <Link
            to={user.role === 'PROVIDER' ? '/provider' : '/history'}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition ${
              isActive('/history') || isActive('/provider') ? 'text-primary font-bold' : 'text-slate-500'
            }`}
          >
            <span className="text-base">📋</span>
            <span>{user.role === 'PROVIDER' ? 'Console' : 'Bookings'}</span>
          </Link>
        )}

        <Link
          to={user ? '/profile' : '/login'}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition ${
            isActive('/profile') || isActive('/login') ? 'text-primary font-bold' : 'text-slate-500'
          }`}
        >
          <span className="text-base">👤</span>
          <span>{user ? 'Profile' : 'Login'}</span>
        </Link>
      </div>
    </nav>
  );
}
