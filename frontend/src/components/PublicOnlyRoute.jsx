import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="auth-loading-screen" role="status" aria-live="polite">
        <div className="auth-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    const destination = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={destination} replace />;
  }

  return children ? children : <Outlet />;
};

export default PublicOnlyRoute;
