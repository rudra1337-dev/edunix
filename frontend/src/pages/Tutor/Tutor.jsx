import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './PlaceholderPage.css';

const Tutor = () => {
  const { user } = useAuth();

  return (
    <div className="placeholder-page">
      <div className="placeholder-container">
        <div className="placeholder-card">
          <div className="placeholder-icon">🤖</div>
          <span className="placeholder-pill">Coming Next in Agentic AI Phase</span>
          <h1 className="placeholder-title">AI Learning Companion</h1>
          <p className="placeholder-desc">
            Hello {user?.name}! The AI tutor conversation engine with context-aware learner
            memory and multi-turn reasoning is part of the next implementation phase.
          </p>

          <div className="placeholder-preview">
            <h3>Planned Capabilities:</h3>
            <ul>
              <li>Adaptive, conversational Socratic tutoring</li>
              <li>Multilingual instruction in your preferred language</li>
              <li>Concept breakdown, analogies, and practice quizzes</li>
            </ul>
          </div>

          <Link to="/dashboard" className="btn btn-secondary">
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Tutor;
