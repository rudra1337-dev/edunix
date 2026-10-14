import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Landing.css';

const Landing = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="landing-page">
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-badge">
            <span className="hero-badge__dot" />
            <span>AI-Driven Education for Every Learner</span>
          </div>

          <h1 className="hero-title">
            Bridge the Gap to Knowledge with <span className="gradient-text">Edunix</span>
          </h1>

          <p className="hero-subtitle">
            An intelligent, hybrid AI learning platform tailored for every student. Experience
            conversational AI tutoring both online and offline, adaptive learning roadmaps,
            continuous progress tracking, and regional language support.
          </p>

          <div className="hero-cta-group">
            <Link to="/chat" className="btn btn-primary btn-lg">
              ⚡ Launch AI Chat
            </Link>
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn btn-secondary btn-lg">
                Dashboard ({user?.name || 'Student'}) →
              </Link>
            ) : (
              <>
                <Link to="/sign-up" className="btn btn-secondary btn-lg">
                  Get Started Free
                </Link>
                <Link to="/sign-in" className="btn btn-secondary btn-lg">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="section-header">
          <h2 className="section-title">Engineered for Deep, Meaningful Learning</h2>
          <p className="section-subtitle">
            Discover how Edunix combines state-of-the-art AI with student-centered pedagogy.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3 className="feature-title">AI Learning Companion</h3>
            <p className="feature-desc">
              A patient, empathetic tutor that adapts explanations to your pace and identifies knowledge gaps.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🗺️</div>
            <h3 className="feature-title">Adaptive Learning Journey</h3>
            <p className="feature-desc">
              Visual roadmap that evolves as you master concepts, providing clear milestones toward your goals.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🧠</div>
            <h3 className="feature-title">Learner Memory</h3>
            <p className="feature-desc">
              Context-aware retention of your strengths, misconceptions, and learning style over time.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🌐</div>
            <h3 className="feature-title">Regional Language First</h3>
            <p className="feature-desc">
              Learn comfortably in Hindi, Odia, Bengali, Tamil, Telugu, and more without language barriers.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
