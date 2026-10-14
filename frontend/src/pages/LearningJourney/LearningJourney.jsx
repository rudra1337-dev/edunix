import { Link } from 'react-router-dom';
import '../Tutor/PlaceholderPage.css';

const LearningJourney = () => {
  return (
    <div className="placeholder-page">
      <div className="placeholder-container">
        <div className="placeholder-card">
          <div className="placeholder-icon">🗺️</div>
          <span className="placeholder-pill">Coming Next in Agentic AI Phase</span>
          <h1 className="placeholder-title">Visual Learning Roadmap</h1>
          <p className="placeholder-desc">
            Your adaptive roadmap will visualize curriculum branches, completed competencies,
            prerequisites, and target milestones.
          </p>

          <div className="placeholder-preview">
            <h3>Planned Capabilities:</h3>
            <ul>
              <li>Interactive milestone graph with dynamic branching</li>
              <li>Prerequisite mastery verification</li>
              <li>Estimated time-to-mastery forecasts</li>
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

export default LearningJourney;
