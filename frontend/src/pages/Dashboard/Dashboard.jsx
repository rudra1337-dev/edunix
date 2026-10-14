import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Dashboard.css';

const LANGUAGE_LABELS = {
  en: 'English',
  hi: 'हिंदी (Hindi)',
  or: 'ଓଡ଼ିଆ (Odia)',
  bn: 'বাংলা (Bengali)',
  te: 'తెలుగు (Telugu)',
  ta: 'தமிழ் (Tamil)',
  mr: 'मराठी (Marathi)',
};

const Dashboard = () => {
  const { user } = useAuth();

  const languageName =
    LANGUAGE_LABELS[user?.preferredLanguage] || user?.preferredLanguage || 'English';

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <header className="dashboard-welcome">
          <div className="welcome-text">
            <h1 className="welcome-title">
              Welcome back, <span className="highlight-text">{user?.name || 'Student'}</span>! 👋
            </h1>
            <p className="welcome-subtitle">
              Ready to continue your personalized learning journey today?
            </p>
          </div>
          <div className="welcome-badges">
            <span className="badge badge--role">{user?.role || 'STUDENT'}</span>
            <span className="badge badge--lang">🗣️ {languageName}</span>
          </div>
        </header>

        <section className="dashboard-grid">
          <Link to="/tutor" className="module-card">
            <div className="module-card__icon">🤖</div>
            <div className="module-card__content">
              <h2 className="module-card__title">AI Learning Companion</h2>
              <p className="module-card__desc">
                Engage in an interactive conversation with your personal AI mentor.
              </p>
            </div>
            <span className="module-card__arrow">Launch →</span>
          </Link>

          <Link to="/learning-journey" className="module-card">
            <div className="module-card__icon">🗺️</div>
            <div className="module-card__content">
              <h2 className="module-card__title">Learning Journey</h2>
              <p className="module-card__desc">
                View your visual curriculum roadmap and upcoming mastery milestones.
              </p>
            </div>
            <span className="module-card__arrow">Explore →</span>
          </Link>

          <Link to="/progress" className="module-card">
            <div className="module-card__icon">📊</div>
            <div className="module-card__content">
              <h2 className="module-card__title">Progress Tracker</h2>
              <p className="module-card__desc">
                Review your retention metrics, completed modules, and study consistency.
              </p>
            </div>
            <span className="module-card__arrow">View Stats →</span>
          </Link>

          <Link to="/study-plan" className="module-card">
            <div className="module-card__icon">📅</div>
            <div className="module-card__content">
              <h2 className="module-card__title">Personalized Study Plan</h2>
              <p className="module-card__desc">
                Follow daily adaptive assignments tailored to your target goals.
              </p>
            </div>
            <span className="module-card__arrow">View Plan →</span>
          </Link>
        </section>

        <section className="dashboard-status-card">
          <div className="status-header">
            <h3>🔐 Active Authenticated Session</h3>
          </div>
          <div className="status-details">
            <div className="status-row">
              <span className="status-label">Email:</span>
              <span className="status-value">{user?.email}</span>
            </div>
            <div className="status-row">
              <span className="status-label">User ID:</span>
              <span className="status-value code-font">{user?.id}</span>
            </div>
            <div className="status-row">
              <span className="status-label">Authentication Transport:</span>
              <span className="status-value highlight">Secure HttpOnly Cookie (JWT)</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
