import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/formatDate';
import './Profile.css';

const LANGUAGE_LABELS = {
  en: 'English',
  hi: 'हिंदी (Hindi)',
  or: 'ଓଡ଼ିଆ (Odia)',
  bn: 'বাংলা (Bengali)',
  te: 'తెలుగు (Telugu)',
  ta: 'தமிழ் (Tamil)',
  mr: 'मराठी (Marathi)',
};

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/sign-in', { replace: true });
  };

  const formattedDate = user?.createdAt ? formatDate(user.createdAt) : 'Recently';

  return (
    <div className="profile-page">
      <div className="profile-container">
        <header className="profile-header">
          <div className="profile-avatar-large">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
          </div>
          <div className="profile-header-info">
            <h1 className="profile-title">{user?.name}</h1>
            <p className="profile-email">{user?.email}</p>
            <span className="profile-role-badge">{user?.role || 'STUDENT'}</span>
          </div>
        </header>

        <section className="profile-card">
          <h2 className="profile-card-title">Student Details & Preferences</h2>

          <div className="profile-details-grid">
            <div className="profile-detail-item">
              <span className="detail-label">Full Name</span>
              <span className="detail-value">{user?.name}</span>
            </div>

            <div className="profile-detail-item">
              <span className="detail-label">Registered Email</span>
              <span className="detail-value">{user?.email}</span>
            </div>

            <div className="profile-detail-item">
              <span className="detail-label">Preferred Learning Language</span>
              <span className="detail-value">
                {LANGUAGE_LABELS[user?.preferredLanguage] || user?.preferredLanguage || 'English'}
              </span>
            </div>

            <div className="profile-detail-item">
              <span className="detail-label">Platform Role</span>
              <span className="detail-value">{user?.role || 'STUDENT'}</span>
            </div>

            <div className="profile-detail-item">
              <span className="detail-label">Member Since</span>
              <span className="detail-value">{formattedDate}</span>
            </div>

            <div className="profile-detail-item">
              <span className="detail-label">Unique Student ID</span>
              <span className="detail-value code-font">{user?.id}</span>
            </div>
          </div>
        </section>

        <section className="profile-danger-zone">
          <div className="danger-text">
            <h3>Account Session</h3>
            <p>Sign out of your active session on this device.</p>
          </div>
          <button type="button" onClick={handleLogout} className="btn-logout-danger">
            Sign Out
          </button>
        </section>
      </div>
    </div>
  );
};

export default Profile;
