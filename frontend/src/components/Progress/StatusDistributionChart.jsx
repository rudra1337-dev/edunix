/**
 * Status Distribution Breakdown Component
 * Visualizes curriculum topics across the 4 learning states:
 * Completed, In Progress, Needs Review, and Not Started.
 */
export const StatusDistributionChart = ({
  distribution = null,
  title = 'Learning Status Distribution',
  subtitle = 'Curriculum units grouped by active learning and retention state',
}) => {
  const { totalTopics = 0, entries = [] } = distribution || {};

  return (
    <div className="analytics-card status-distribution-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">{title}</h3>
          <p className="analytics-card-subtitle">{subtitle}</p>
        </div>
        <span className="analytics-badge-count">{totalTopics} Total Units</span>
      </div>

      {totalTopics === 0 ? (
        <div className="chart-empty-state">
          <span className="empty-icon">📊</span>
          <p className="empty-title">No Topic Distribution Data</p>
          <p className="empty-desc">Add modules to your roadmap to view learning state distribution.</p>
        </div>
      ) : (
        <div className="status-distribution-body">
          {/* Segmented Stacked Bar */}
          <div
            className="stacked-status-bar"
            role="progressbar"
            aria-label="Stacked status distribution bar"
          >
            {entries.map((entry) => {
              if (entry.count === 0) return null;
              return (
                <div
                  key={entry.key}
                  className="stacked-status-segment"
                  style={{
                    width: `${entry.percentage}%`,
                    background: entry.color,
                  }}
                  title={`${entry.label}: ${entry.count} topics (${entry.percentage}%)`}
                />
              );
            })}
          </div>

          {/* Cards for each status explanation */}
          <div className="status-cards-grid">
            {entries.map((entry) => (
              <div
                key={entry.key}
                className="status-detail-card"
                style={{ borderLeftColor: entry.color }}
              >
                <div className="status-card-header">
                  <div className="status-label-wrap">
                    <span className="status-icon">{entry.icon}</span>
                    <span className="status-label">{entry.label}</span>
                  </div>
                  <span className="status-count-badge" style={{ background: entry.badgeBg, color: entry.color }}>
                    {entry.count} ({entry.percentage}%)
                  </span>
                </div>
                <p className="status-description">{entry.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusDistributionChart;
