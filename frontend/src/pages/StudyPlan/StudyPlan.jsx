import { Link } from 'react-router-dom';
import '../Tutor/PlaceholderPage.css';

const StudyPlan = () => {
  return (
    <div className="placeholder-page">
      <div className="placeholder-container">
        <div className="placeholder-card">
          <div className="placeholder-icon">📅</div>
          <span className="placeholder-pill">Coming Next in Agentic AI Phase</span>
          <h1 className="placeholder-title">Personalized Study Plan</h1>
          <p className="placeholder-desc">
            An automated schedule engineered around your target exam or learning objective,
            adapting in real-time based on your daily availability and quiz outcomes.
          </p>

          <div className="placeholder-preview">
            <h3>Planned Capabilities:</h3>
            <ul>
              <li>Goal-driven study schedules (e.g. 30/60/90-day targets)</li>
              <li>Daily micro-learning assignments and practice challenges</li>
              <li>Dynamic rescheduling if a day is missed</li>
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

export default StudyPlan;
