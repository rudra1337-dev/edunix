import { NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isChat = location.pathname === '/chat' || location.pathname === '/tutor';

  const handleLogout = async () => {
    await logout();
    navigate('/sign-in', { replace: true });
  };

  return (
    <div className={`layout ${isChat ? 'layout--chat' : ''}`}>
      <header className="layout__header">
        <div className="layout__header-inner">
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="layout__brand">
            <span className="layout__brand-icon">⚡</span>
            <div className="layout__brand-text">
              <span className="layout__logo">Edunix</span>
              <span className="layout__tagline">AI-Powered Learning</span>
            </div>
          </Link>

          <nav className="layout__nav" aria-label="Main Navigation">
            {isAuthenticated ? (
              <>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    `layout__link ${isActive ? 'layout__link--active' : ''}`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/chat"
                  className={({ isActive }) =>
                    `layout__link ${isActive ? 'layout__link--active' : ''}`
                  }
                >
                  AI Chat
                </NavLink>
                <NavLink
                  to="/learning-journey"
                  className={({ isActive }) =>
                    `layout__link ${isActive ? 'layout__link--active' : ''}`
                  }
                >
                  Journey
                </NavLink>
                <NavLink
                  to="/progress"
                  className={({ isActive }) =>
                    `layout__link ${isActive ? 'layout__link--active' : ''}`
                  }
                >
                  Progress
                </NavLink>
                <NavLink
                  to="/study-plan"
                  className={({ isActive }) =>
                    `layout__link ${isActive ? 'layout__link--active' : ''}`
                  }
                >
                  Study Plan
                </NavLink>
                <NavLink
                  to="/profile"
                  className={({ isActive }) =>
                    `layout__link ${isActive ? 'layout__link--active' : ''}`
                  }
                >
                  Profile
                </NavLink>
              </>
            ) : (
              <>
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `layout__link ${isActive ? 'layout__link--active' : ''}`
                  }
                >
                  Home
                </NavLink>
                <NavLink
                  to="/chat"
                  className={({ isActive }) =>
                    `layout__link ${isActive ? 'layout__link--active' : ''}`
                  }
                >
                  AI Chat
                </NavLink>
                <NavLink
                  to="/about"
                  className={({ isActive }) =>
                    `layout__link ${isActive ? 'layout__link--active' : ''}`
                  }
                >
                  About
                </NavLink>
              </>
            )}
          </nav>

          <div className="layout__actions">
            {isAuthenticated ? (
              <div className="layout__user-menu">
                <Link to="/profile" className="layout__user-badge" title="View Profile">
                  <span className="layout__user-avatar">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
                  </span>
                  <div className="layout__user-meta">
                    <span className="layout__user-name">{user?.name}</span>
                    <span className="layout__user-role">{user?.role || 'STUDENT'}</span>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="layout__logout-btn"
                  title="Log out of Edunix"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="layout__auth-links">
                <Link to="/sign-in" className="layout__btn layout__btn--ghost">
                  Sign In
                </Link>
                <Link to="/sign-up" className="layout__btn layout__btn--primary">
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={`layout__main ${isChat ? 'layout__main--chat' : ''}`}>{children}</main>

      {!isChat && (
        <footer className="layout__footer">
          <p>© 2026 Edunix. Online & Offline AI Learning Platform.</p>
        </footer>
      )}
    </div>
  );
};

export default Layout;
