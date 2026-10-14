/**
 * Personalized Learning Insights Component
 * Displays factual, evidence-based study observations and guidance.
 */
export const LearningInsightsList = ({
  insights = [],
  title = 'Personalized Learning Insights',
  subtitle = 'Actionable empirical observations derived from your study milestones',
}) => {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="analytics-card insights-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">{title}</h3>
          <p className="analytics-card-subtitle">{subtitle}</p>
        </div>
        <span className="analytics-badge-count">{insights.length} Insights</span>
      </div>

      <div className="insights-grid">
        {insights.map((ins) => (
          <div key={ins.id} className={`insight-item insight-item--${ins.type}`}>
            <div className="insight-icon-box">{ins.icon}</div>
            <div className="insight-content">
              <h4 className="insight-item-title">{ins.title}</h4>
              <p className="insight-item-text">{ins.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LearningInsightsList;
