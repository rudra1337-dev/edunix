import { Link } from 'react-router-dom';
import '../Tutor/PlaceholderPage.css';

const Progress = () => {
  return (
    <div className="placeholder-page">
      <div className="placeholder-container">
        <div className="placeholder-card">
          <div className="placeholder-icon">📊</div>
          <span className="placeholder-pill">Coming Next in Agentic AI Phase</span>
          <h1 className="placeholder-title">Student Progress Tracker</h1>
          <p className="placeholder-desc">
            Monitor conceptual retention, learning streak, practice accuracy, and areas where
            targeted review is recommended.
          </p>

          <div className="placeholder-preview">
            <h3>Planned Capabilities:</h3>
            <ul>
              <li>Spaced repetition and retention analytics</li>
              <li>Weak area diagnosis and auto-generated refresher drills</li>
              <li>Study streak and milestones badges</li>
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

export default Progress;
