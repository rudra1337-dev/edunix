import { Link } from 'react-router-dom';

/**
 * Roadmap Comparison Chart
 * Horizontal progress bars comparing completion percentage, completed vs remaining
 * topics, and subtask checklist rates across all user roadmaps.
 */
export const RoadmapComparisonChart = ({
  comparisonData = [],
  title = 'Roadmap Progress Comparison',
  subtitle = 'Comparative view of progress across all your active learning paths',
}) => {
  if (!comparisonData || comparisonData.length === 0) {
    return (
      <div className="analytics-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">{title}</h3>
            <p className="analytics-card-subtitle">{subtitle}</p>
          </div>
        </div>
        <div className="chart-empty-state">
          <span className="empty-icon">🗺️</span>
          <p className="empty-title">No Roadmaps Found</p>
          <p className="empty-desc">Create learning roadmaps to compare progress across subjects.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-card roadmap-comparison-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">{title}</h3>
          <p className="analytics-card-subtitle">{subtitle}</p>
        </div>
        <span className="analytics-badge-count">{comparisonData.length} Roadmaps</span>
      </div>

      <div className="comparison-list">
        {comparisonData.map((item) => {
          const isComplete = item.percentage === 100;

          return (
            <div key={item.id} className="comparison-row">
              <div className="comparison-header">
                <div className="comparison-title-wrap">
                  <span className="comparison-badge-status">{item.status}</span>
                  <Link
                    to={`/learning-journey/${item.id}`}
                    className="comparison-title"
                    title={item.title}
                  >
                    {item.title}
                  </Link>
                </div>
                <div className="comparison-stats-summary">
                  <span className="comparison-topics-count">
                    {item.completedTopics} / {item.totalTopics} Topics
                  </span>
                  <span className="comparison-rate-badge">{item.percentage}%</span>
                </div>
              </div>

              {/* Multi-segment Progress Track */}
              <div className="comparison-progress-track" role="progressbar" aria-valuenow={item.percentage} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="comparison-progress-fill"
                  style={{
                    width: `${item.percentage}%`,
                    background: isComplete
                      ? 'linear-gradient(90deg, #10b981, #059669)'
                      : 'linear-gradient(90deg, #6366f1, #818cf8)',
                  }}
                />
              </div>

              {/* Sub-metrics footer */}
              <div className="comparison-footer">
                <span className="comparison-sub-detail">
                  {item.remainingTopics > 0
                    ? `${item.remainingTopics} topics remaining`
                    : '🎉 All curriculum units mastered'}
                </span>
                <Link to={`/learning-journey/${item.id}`} className="comparison-action-link">
                  Open Workspace &rarr;
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RoadmapComparisonChart;
