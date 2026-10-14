import { useState, useMemo } from 'react';

/**
 * Interactive Activity Timeline Line/Area Chart
 * Visualizes real historical learning activity and cumulative completions.
 * Strictly respects real evidence without fabricating past dates or percentages.
 */
export const ActivityTimelineChart = ({
  timelineData = null,
  activeRange = '30d',
  onRangeChange = () => {},
  title = 'Learning Activity & Progress Over Time',
  subtitle = 'Real-time record of completed checklist tasks and learning events',
}) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const { hasData, timeline = [], summary = {} } = timelineData || {};

  const rangeOptions = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
    { label: 'All Time', value: 'all' },
  ];

  // SVG Chart Geometry
  const width = 640;
  const height = 220;
  const padding = { top: 25, right: 25, bottom: 35, left: 40 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const chartData = useMemo(() => {
    if (!hasData || timeline.length === 0) return null;

    const maxVal = Math.max(5, ...timeline.map((d) => d.totalActivity));
    const points = timeline.map((d, index) => {
      const x = padding.left + (index / (timeline.length - 1 || 1)) * innerWidth;
      const y = padding.top + innerHeight - (d.totalActivity / maxVal) * innerHeight;
      return { ...d, x, y };
    });

    // Build SVG path
    const pathD = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    // Build closed area path for subtle gradient fill
    const areaD =
      points.length > 0
        ? `${pathD} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${
            padding.top + innerHeight
          } Z`
        : '';

    return { points, pathD, areaD, maxVal };
  }, [hasData, timeline, innerWidth, innerHeight, padding.left, padding.top]);

  return (
    <div className="analytics-card activity-timeline-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">{title}</h3>
          <p className="analytics-card-subtitle">{subtitle}</p>
        </div>

        {/* Range Selector Controls */}
        <div className="chart-range-selector" role="group" aria-label="Select date range">
          {rangeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`range-btn ${activeRange === opt.value ? 'range-btn--active' : ''}`}
              onClick={() => onRangeChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData || timeline.length === 0 ? (
        <div className="chart-empty-state">
          <span className="empty-icon">📈</span>
          <p className="empty-title">Activity Tracking Initiated</p>
          <p className="empty-desc">
            Historical learning curves begin as you complete topics, practice exercises, or toggle
            checklist tasks in your Learning Journey.
          </p>
        </div>
      ) : (
        <div className="activity-chart-wrapper">
          {/* Quick Summary Strip */}
          <div className="activity-kpi-summary">
            <div className="summary-pill">
              <span className="summary-label">Active Days:</span>
              <span className="summary-value">{summary.totalActiveDays || 0}</span>
            </div>
            <div className="summary-pill">
              <span className="summary-label">Actions Recorded:</span>
              <span className="summary-value">{summary.totalActions || 0}</span>
            </div>
            <div className="summary-pill">
              <span className="summary-label">Units Completed:</span>
              <span className="summary-value">{summary.totalCompletions || 0}</span>
            </div>
          </div>

          <div className="timeline-svg-container">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="activity-line-svg"
              role="img"
              aria-label="Interactive line chart showing learning actions and completions over time"
            >
              <defs>
                <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                const y = padding.top + innerHeight * (1 - pct);
                return (
                  <line
                    key={idx}
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.05)"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Gradient Area Fill */}
              {chartData && (
                <path d={chartData.areaD} fill="url(#activityGradient)" />
              )}

              {/* Main Activity Trend Line */}
              {chartData && (
                <path
                  d={chartData.pathD}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data Points */}
              {chartData &&
                chartData.points.map((pt, idx) => {
                  const isHovered = hoveredPoint?.date === pt.date;
                  if (pt.totalActivity === 0 && !isHovered) return null;

                  return (
                    <g key={idx}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 6 : 4}
                        fill={isHovered ? '#fff' : '#818cf8'}
                        stroke="#4f46e5"
                        strokeWidth="2"
                        className="activity-dot"
                        tabIndex={0}
                        onMouseEnter={() => setHoveredPoint(pt)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        onFocus={() => setHoveredPoint(pt)}
                        onBlur={() => setHoveredPoint(null)}
                        aria-label={`${pt.displayDate}: ${pt.totalActivity} actions, ${pt.completionsCount} completed`}
                      />
                    </g>
                  );
                })}

              {/* X-Axis Labels */}
              {chartData &&
                chartData.points
                  .filter((_, idx, arr) => {
                    const step = Math.max(1, Math.floor(arr.length / 5));
                    return idx === 0 || idx === arr.length - 1 || idx % step === 0;
                  })
                  .map((pt, idx) => (
                    <text
                      key={idx}
                      x={pt.x}
                      y={height - 10}
                      fontSize="10"
                      fill="#64748b"
                      textAnchor="middle"
                    >
                      {pt.displayDate}
                    </text>
                  ))}
            </svg>

            {/* Interactive Tooltip */}
            {hoveredPoint && (
              <div
                className="chart-tooltip"
                style={{
                  left: `${(hoveredPoint.x / width) * 100}%`,
                  top: `${(hoveredPoint.y / height) * 100}%`,
                }}
              >
                <span className="tooltip-date">{hoveredPoint.displayDate}</span>
                <div className="tooltip-metric">
                  <span>⚡ Actions Recorded:</span>
                  <strong>{hoveredPoint.eventsCount}</strong>
                </div>
                <div className="tooltip-metric">
                  <span>✅ Completed Units:</span>
                  <strong>{hoveredPoint.completionsCount}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityTimelineChart;
