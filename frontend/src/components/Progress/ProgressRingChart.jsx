import { useState } from 'react';

/**
 * Interactive SVG Donut / Progress Ring Chart
 * Displays overall completion percentage with interactive status segments,
 * accessible tooltips, and screen-reader data table.
 */
export const ProgressRingChart = ({
  percentage = 0,
  entries = [],
  totalTopics = 0,
  title = 'Overall Learning Progress',
  subtitle = 'Progress across all eligible curriculum modules',
}) => {
  const [activeSegment, setActiveSegment] = useState(null);

  const radius = 72;
  const strokeWidth = 18;
  const center = 100;
  const circumference = 2 * Math.PI * radius;

  // Filter non-zero entries for SVG drawing
  const validEntries = entries.filter((e) => e.count > 0);
  let accumulatedOffset = 0;

  return (
    <div className="analytics-card progress-ring-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">{title}</h3>
          <p className="analytics-card-subtitle">{subtitle}</p>
        </div>
        <span className="analytics-badge-rate">{percentage}% Mastered</span>
      </div>

      <div className="progress-ring-body">
        {totalTopics === 0 ? (
          <div className="chart-empty-state">
            <span className="empty-icon">📊</span>
            <p className="empty-title">No Curriculum Topics Available</p>
            <p className="empty-desc">Create or activate a roadmap to track your progress metrics.</p>
          </div>
        ) : (
          <>
            <div className="progress-ring-wrapper">
              <svg
                viewBox="0 0 200 200"
                className="progress-ring-svg"
                role="img"
                aria-label={`Donut chart showing ${percentage}% completion: ${entries
                  .map((e) => `${e.label}: ${e.count} (${e.percentage}%)`)
                  .join(', ')}`}
              >
                {/* Background Ring Track */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeWidth={strokeWidth}
                />

                {/* Segments */}
                {validEntries.map((entry) => {
                  const fraction = totalTopics > 0 ? entry.count / totalTopics : 0;
                  const strokeLength = fraction * circumference;
                  const strokeDasharray = `${strokeLength} ${circumference - strokeLength}`;
                  const strokeDashoffset = -accumulatedOffset;
                  accumulatedOffset += strokeLength;

                  const isHovered = activeSegment?.key === entry.key;

                  return (
                    <circle
                      key={entry.key}
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="none"
                      stroke={entry.color}
                      strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="progress-ring-segment"
                      style={{
                        transform: 'rotate(-90deg)',
                        transformOrigin: '50% 50%',
                        transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                        cursor: 'pointer',
                        opacity: activeSegment && !isHovered ? 0.45 : 1,
                      }}
                      onMouseEnter={() => setActiveSegment(entry)}
                      onMouseLeave={() => setActiveSegment(null)}
                      onFocus={() => setActiveSegment(entry)}
                      onBlur={() => setActiveSegment(null)}
                      tabIndex={0}
                      aria-label={`${entry.label}: ${entry.count} topics (${entry.percentage}%)`}
                    />
                  );
                })}
              </svg>

              {/* Center Metrics Overlay */}
              <div className="progress-ring-center">
                <span className="ring-center-value">
                  {activeSegment ? `${activeSegment.percentage}%` : `${percentage}%`}
                </span>
                <span className="ring-center-label">
                  {activeSegment ? activeSegment.label : 'Completed'}
                </span>
                <span className="ring-center-sub">
                  {activeSegment
                    ? `${activeSegment.count} / ${totalTopics} topics`
                    : `${entries.find((e) => e.key === 'completed')?.count || 0} / ${totalTopics} topics`}
                </span>
              </div>
            </div>

            {/* Accessible Legend & Status Breakdown */}
            <div className="progress-ring-legend" role="list">
              {entries.map((entry) => {
                const isHovered = activeSegment?.key === entry.key;
                return (
                  <div
                    key={entry.key}
                    className={`legend-item ${isHovered ? 'legend-item--active' : ''}`}
                    onMouseEnter={() => setActiveSegment(entry)}
                    onMouseLeave={() => setActiveSegment(null)}
                    role="listitem"
                  >
                    <span
                      className="legend-dot"
                      style={{ background: entry.color, boxShadow: `0 0 6px ${entry.color}` }}
                    />
                    <div className="legend-info">
                      <span className="legend-name">{entry.label}</span>
                      <span className="legend-count">
                        {entry.count} <small>({entry.percentage}%)</small>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProgressRingChart;
