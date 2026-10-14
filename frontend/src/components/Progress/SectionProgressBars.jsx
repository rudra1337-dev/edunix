import { Link } from 'react-router-dom';

/**
 * Section-Level Progress Bars
 * Visualizes curriculum module progress within structured roadmap sections.
 */
export const SectionProgressBars = ({
  sections = [],
  roadmapId = null,
  title = 'Curriculum Section Breakdown',
  subtitle = 'Progress across sequential roadmap modules and thematic units',
}) => {
  if (!sections || sections.length === 0) {
    return (
      <div className="analytics-card section-progress-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">{title}</h3>
            <p className="analytics-card-subtitle">{subtitle}</p>
          </div>
        </div>
        <div className="chart-empty-state">
          <span className="empty-icon">📑</span>
          <p className="empty-title">No Structured Sections</p>
          <p className="empty-desc">This curriculum does not contain section partitions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-card section-progress-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">{title}</h3>
          <p className="analytics-card-subtitle">{subtitle}</p>
        </div>
        <span className="analytics-badge-count">{sections.length} Sections</span>
      </div>

      <div className="section-progress-list">
        {sections.map((sec) => {
          const isFinished = sec.percentage === 100;
          return (
            <div key={sec.id} className="section-progress-item">
              <div className="section-item-header">
                <div className="section-title-wrap">
                  <span className="section-order-badge">#{sec.order}</span>
                  <span className="section-title">{sec.title}</span>
                </div>
                <div className="section-metrics">
                  <span className="section-topic-counts">
                    {sec.completedTopics} / {sec.totalTopics} Units
                  </span>
                  <span className="section-percent-badge">{sec.percentage}%</span>
                </div>
              </div>

              {sec.description && (
                <p className="section-description">{sec.description}</p>
              )}

              {/* Progress Bar */}
              <div
                className="section-bar-track"
                role="progressbar"
                aria-valuenow={sec.percentage}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="section-bar-fill"
                  style={{
                    width: `${sec.percentage}%`,
                    background: isFinished
                      ? 'linear-gradient(90deg, #10b981, #059669)'
                      : 'linear-gradient(90deg, #6366f1, #818cf8)',
                  }}
                />
              </div>

              <div className="section-item-footer">
                <span className="section-subtasks-stat">
                  {sec.totalSubtasks > 0
                    ? `📝 ${sec.subtasksCompleted} / ${sec.totalSubtasks} checklist tasks completed`
                    : `${sec.totalTopics - sec.completedTopics} topics remaining`}
                </span>
                {roadmapId && (
                  <Link
                    to={`/learning-journey/${roadmapId}`}
                    className="section-explore-link"
                  >
                    View in Journey &rarr;
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SectionProgressBars;
