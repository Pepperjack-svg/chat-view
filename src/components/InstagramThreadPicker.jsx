import { useState, useMemo } from 'react';
import { ArrowLeft, MessagesSquare, Search, Loader2 } from 'lucide-react';

export default function InstagramThreadPicker({ threads, zip, mediaMap, onSelect, onBack }) {
  const [query, setQuery] = useState('');
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => t.title.toLowerCase().includes(q));
  }, [threads, query]);

  async function handlePick(thread) {
    if (loadingId) return;
    setError(null);
    setLoadingId(thread.id);
    try {
      const { parseInstagramThread } = await import('../utils/instagramParser.js');
      const messages = await parseInstagramThread(zip, thread.id, mediaMap);
      onSelect({ messages, mediaMap, fileName: thread.title });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse this conversation.');
      setLoadingId(null);
    }
  }

  return (
    <div className="ig-picker-screen">
      <header className="ig-picker-header">
        <button className="back-btn" onClick={onBack} title="Back">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div>
          <p className="ig-picker-title">Choose a conversation</p>
          <p className="ig-picker-meta">{threads.length.toLocaleString()} conversations found in this export</p>
        </div>
      </header>

      <div className="ig-picker-search">
        <Search size={16} strokeWidth={1.5} />
        <input
          type="text"
          placeholder="Search conversations…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="ig-picker-list">
        {filtered.map((t) => (
          <button
            key={t.id}
            className="ig-picker-item"
            disabled={loadingId !== null}
            onClick={() => handlePick(t)}
          >
            <div className="ig-picker-avatar">
              <MessagesSquare size={18} strokeWidth={1.5} />
            </div>
            <div className="ig-picker-item-info">
              <p className="ig-picker-item-name">{t.title}</p>
              <p className="ig-picker-item-count">{t.messageCount.toLocaleString()} messages</p>
            </div>
            {loadingId === t.id && <Loader2 size={16} className="spin" strokeWidth={1.5} />}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="ig-picker-empty">No conversations match "{query}".</p>
        )}
      </div>

      {error && <div className="ig-picker-error">⚠ {error}</div>}
    </div>
  );
}
