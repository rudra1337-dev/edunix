import './ChatHeader.css';

export const ChatHeader = ({
  title,
  mode,
  onModeChange,
  onToggleSidebar,
  status,
  isGenerating,
  syncState,
  onTriggerSync,
}) => {
  const normalizedMode =
    mode === 'agentic' || mode === 'n8n'
      ? 'agentic'
      : mode === 'offline'
      ? 'local'
      : mode === 'online'
      ? 'gemini'
      : mode || 'auto';

  const getStatusBadge = () => {
    // 1. Dedicated Agentic AI Mode (Testing & direct execution)
    if (normalizedMode === 'agentic') {
      const isAvailable = status?.agentic?.available || status?.n8n?.available;
      return isAvailable ? (
        <span
          className="status-indicator status-indicator--online"
          title={status?.agentic?.message || status?.n8n?.message || 'Dedicated n8n Agentic AI ready'}
        >
          ● Agentic AI Ready
        </span>
      ) : (
        <span
          className="status-indicator status-indicator--warning"
          title={status?.agentic?.message || status?.n8n?.message || 'Dedicated Agentic AI webhook unreachable'}
        >
          ▲ Agentic AI Offline
        </span>
      );
    }

    // 2. Gemini Mode
    if (normalizedMode === 'gemini') {
      const isAvailable = status?.gemini?.available || status?.online?.available;
      return isAvailable ? (
        <span
          className="status-indicator status-indicator--online"
          title={status?.gemini?.message || status?.online?.message || 'Gemini AI configured and ready'}
        >
          ● Gemini Ready
        </span>
      ) : (
        <span
          className="status-indicator status-indicator--warning"
          title={status?.gemini?.message || status?.online?.message || 'Gemini API key unconfigured'}
        >
          ▲ Gemini Unconfigured
        </span>
      );
    }

    // 3. Local / Ollama Mode
    if (normalizedMode === 'local') {
      const isAvailable = status?.ollama?.available || status?.offline?.available;
      return isAvailable ? (
        <span
          className="status-indicator status-indicator--online"
          title={status?.ollama?.message || status?.offline?.message || 'Local Ollama ready'}
        >
          ● Ollama Ready
        </span>
      ) : (
        <span
          className="status-indicator status-indicator--offline"
          title={status?.ollama?.message || status?.offline?.message || 'Local Ollama not detected'}
        >
          ○ Ollama Offline
        </span>
      );
    }

    // 4. Auto Mode (n8n Agentic AI primary + local Ollama fallback)
    const isN8nReady = status?.agentic?.available || status?.n8n?.available;
    const isLocalReady = status?.ollama?.available || status?.offline?.available;

    if (isN8nReady) {
      return (
        <span
          className="status-indicator status-indicator--online"
          title={status?.n8n?.message || 'n8n Agentic AI primary ready'}
        >
          ● Auto (Agentic AI)
        </span>
      );
    } else if (isLocalReady) {
      return (
        <span
          className="status-indicator status-indicator--fallback"
          title="n8n webhook unavailable, local Ollama fallback ready"
        >
          ⚡ Auto (Local Fallback Ready)
        </span>
      );
    } else {
      return (
        <span
          className="status-indicator status-indicator--warning"
          title="Checking AI services availability..."
        >
          ▲ Services Checking
        </span>
      );
    }
  };

  const getSyncBadge = () => {
    if (!syncState) return null;
    if (syncState.isSyncing) {
      return (
        <span className="status-indicator status-indicator--online" title="Synchronizing with server...">
          🔄 Syncing...
        </span>
      );
    }
    if (syncState.pendingCount > 0) {
      return (
        <button
          type="button"
          onClick={onTriggerSync}
          className="status-indicator status-indicator--fallback"
          style={{ cursor: 'pointer', border: 'none' }}
          title="Changes saved in IndexedDB. Click to sync with cloud."
        >
          ⚡ {syncState.pendingCount} Offline Queued
        </button>
      );
    }
    return (
      <span className="status-indicator status-indicator--online" title="IndexedDB memory active and in sync">
        💾 Offline Memory Active
      </span>
    );
  };

  return (
    <header className="chat-header">
      <div className="chat-header-left">
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <div className="chat-header-title-box">
          <h2 className="chat-header-title">{title || 'New Conversation'}</h2>
          <span className="chat-header-brand-tag">EDUNIX AI</span>
        </div>
      </div>

      <div className="chat-header-right">
        {/* Offline Memory / Sync Status Indicator */}
        <div className="chat-status-wrapper">{getSyncBadge()}</div>

        {/* Real-time Service Status Indicator */}
        <div className="chat-status-wrapper">{getStatusBadge()}</div>

        {/* Manual Mode Selector */}
        <div className="mode-selector-wrapper">
          <label htmlFor="ai-mode-select" className="sr-only">
            Select AI Provider Mode
          </label>
          <select
            id="ai-mode-select"
            value={normalizedMode}
            disabled={isGenerating}
            onChange={(e) => onModeChange(e.target.value)}
            className={`mode-select mode-select--${normalizedMode}`}
            title="Unified AI Provider Mode"
          >
            <option value="auto">⚡ Auto (Agentic + Fallback)</option>
            <option value="agentic">🤖 Agentic AI (Dedicated)</option>
            <option value="local">💻 Local — Offline AI</option>
            <option value="gemini">🌐 Gemini AI</option>
          </select>
        </div>
      </div>
    </header>
  );
};

export default ChatHeader;
