import { useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getColorForSender } from '../utils/colors.js';
import { ImageOff, Video, Music, Trash2, ArrowLeft, File } from 'lucide-react';

// ─── URL detection ───────────────────────────────────────────────
const URL_RE = /https?:\/\/[^\s\u200e\u200f<>"]+/g;

function isSafeUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function renderText(text) {
  if (!text) return null;
  URL_RE.lastIndex = 0;
  const segments = [];
  let last = 0;
  let match;
  while ((match = URL_RE.exec(text)) !== null) {
    // Strip trailing punctuation that's unlikely part of the URL
    let url = match[0].replace(/[.,;:!?'")\]]+$/, '');
    if (!isSafeUrl(url)) {
      last = match.index + match[0].length;
      continue;
    }
    if (match.index > last) segments.push(text.slice(last, match.index));
    segments.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="chat-link"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );
    last = match.index + url.length;
  }
  if (last < text.length) segments.push(text.slice(last));
  // If no URLs found, return plain string (avoids array wrapper)
  return segments.length === 0 ? text : segments;
}

// ─── Date formatting (cached) ────────────────────────────────────
const dateCache = new Map();
function formatDate(dateStr) {
  if (dateCache.has(dateStr)) return dateCache.get(dateStr);
  const sep = dateStr.includes('/') ? '/' : dateStr.includes('.') ? '.' : '-';
  const parts = dateStr.split(sep);
  if (parts.length !== 3) { dateCache.set(dateStr, dateStr); return dateStr; }
  const [a, b, c] = parts.map(Number);
  const year = c < 100 ? 2000 + c : c;
  const date = new Date(year, b - 1, a);
  const formatted = isNaN(date.getTime())
    ? dateStr
    : date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  dateCache.set(dateStr, formatted);
  return formatted;
}

// ─── Flatten messages into virtual list ─────────────────────────
function buildFlatList(messages, ownSender) {
  const items = [];
  let lastDate = null;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.date !== lastDate) {
      items.push({ type: 'date-pill', date: msg.date, key: `dp-${i}` });
      lastDate = msg.date;
    }
    if (msg.isSystem) {
      items.push({ type: 'system', msg, key: `sys-${i}` });
    } else {
      const prev = messages[i - 1];
      const prevSender = (prev && !prev.isSystem && prev.date === msg.date) ? prev.sender : null;
      items.push({ type: 'bubble', msg, isOwn: msg.sender === ownSender, prevSender, key: `msg-${i}` });
    }
  }
  return items;
}

// ─── Media omitted label (shows file type hint) ─────────────────
function omittedLabel(filename) {
  if (!filename) return 'Media omitted';
  const lower = filename.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|heic|bmp)$/.test(lower)) return 'Photo not included in export';
  if (/\.(mp4|mov|avi|mkv|webm|3gp)$/.test(lower)) return 'Video not included in export';
  if (/\.(mp3|ogg|opus|m4a|aac|wav|amr|oga)$/.test(lower)) return 'Audio not included in export';
  if (/\.webp$/.test(lower)) return 'Sticker not included in export';
  return `File not included in export`;
}

function omittedIcon(filename) {
  if (!filename) return <ImageOff size={15} strokeWidth={1.5} />;
  const lower = filename.toLowerCase();
  if (/\.(mp4|mov|avi|mkv|webm|3gp)$/.test(lower)) return <Video size={15} strokeWidth={1.5} />;
  if (/\.(mp3|ogg|opus|m4a|aac|wav|amr|oga)$/.test(lower)) return <Music size={15} strokeWidth={1.5} />;
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)$/.test(lower)) return <File size={15} strokeWidth={1.5} />;
  return <ImageOff size={15} strokeWidth={1.5} />;
}

// ─── Media content ───────────────────────────────────────────────
const MediaContent = memo(function MediaContent({ msg, mediaMap }) {
  if (msg.deleted) {
    return (
      <span className="msg-deleted">
        <Trash2 size={13} strokeWidth={1.5} /> This message was deleted
      </span>
    );
  }

  if (msg.mediaOmitted || (msg.mediaFilename && !mediaMap[msg.mediaFilename] && !mediaMap[msg.mediaFilename?.toLowerCase()])) {
    return (
      <div className="media-omitted">
        {omittedIcon(msg.mediaFilename)}
        <span>{omittedLabel(msg.mediaFilename)}</span>
      </div>
    );
  }

  if (msg.mediaFilename) {
    const media = mediaMap[msg.mediaFilename] || mediaMap[msg.mediaFilename.toLowerCase()];
    if (!media) return null;

    if (media.type === 'image') {
      return (
        <a href={media.url} target="_blank" rel="noreferrer" className="media-img-link">
          <img src={media.url} alt={msg.mediaFilename} className="chat-image" loading="lazy" />
        </a>
      );
    }
    if (media.type === 'video') {
      return <video src={media.url} controls className="chat-video" />;
    }
    if (media.type === 'audio') {
      return (
        <div className="media-audio">
          <Music size={14} strokeWidth={1.5} />
          <audio src={media.url} controls className="chat-audio" />
        </div>
      );
    }
  }

  return null;
});

// ─── Single message bubble ───────────────────────────────────────
const MessageBubble = memo(function MessageBubble({ msg, mediaMap, isOwn, prevSender }) {
  const color = getColorForSender(msg.sender);
  const showSender = !isOwn && msg.sender !== prevSender;
  const textContent = renderText(msg.text);

  return (
    <div className={`bubble-row ${isOwn ? 'own' : 'other'}`}>
      <div
        className={`bubble ${isOwn ? 'bubble-own' : 'bubble-other'}`}
        style={isOwn ? undefined : { background: color.bg, borderColor: color.border }}
      >
        {showSender && (
          <span className="bubble-sender" style={{ color: color.name }}>{msg.sender}</span>
        )}
        <MediaContent msg={msg} mediaMap={mediaMap} />
        {msg.text ? <p className="bubble-text">{textContent}</p> : null}
        <span className="bubble-time">{msg.time}</span>
      </div>
    </div>
  );
});

// ─── Row rendered by virtualizer ─────────────────────────────────
const VirtualRow = memo(function VirtualRow({ item, mediaMap }) {
  if (item.type === 'date-pill') return <div className="date-pill">{formatDate(item.date)}</div>;
  if (item.type === 'system')   return <div className="system-msg">{item.msg.text}</div>;
  return <MessageBubble msg={item.msg} mediaMap={mediaMap} isOwn={item.isOwn} prevSender={item.prevSender} />;
});

// ─── Main component ──────────────────────────────────────────────
export default function ChatViewer({ messages, mediaMap, fileName, onReset }) {
  const scrollRef = useRef(null);

  const ownSender = useMemo(() => {
    const counts = new Map();
    for (const m of messages) {
      if (!m.isSystem && m.sender) counts.set(m.sender, (counts.get(m.sender) || 0) + 1);
    }
    let max = 0, own = null;
    for (const [s, c] of counts) if (c > max) { max = c; own = s; }
    return own;
  }, [messages]);

  const flatItems = useMemo(() => buildFlatList(messages, ownSender), [messages, ownSender]);

  const estimateSize = useCallback((i) => {
    const item = flatItems[i];
    if (item.type === 'date-pill') return 44;
    if (item.type === 'system')    return 36;
    const msg = item.msg;
    if (msg.mediaFilename) return 240;
    if (msg.mediaOmitted)  return 52;
    const lines = (msg.text || '').split('\n').length;
    return Math.max(52, 38 + lines * 21);
  }, [flatItems]);

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: 20,
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const totalMessages = useMemo(() => messages.filter((m) => !m.isSystem).length, [messages]);
  const senderCount   = useMemo(() => {
    const s = new Set(messages.filter((m) => !m.isSystem && m.sender).map((m) => m.sender));
    return s.size;
  }, [messages]);

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize    = virtualizer.getTotalSize();

  return (
    <div className="chat-screen">
      <header className="chat-header">
        <button className="back-btn" onClick={onReset} title="Back">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className="chat-header-info">
          <div className="chat-header-avatar">{fileName.charAt(0).toUpperCase()}</div>
          <div>
            <p className="chat-header-name">{fileName.replace(/\.(zip|txt|json)$/i, '')}</p>
            <p className="chat-header-meta">
              {totalMessages.toLocaleString()} messages · {senderCount} participants
            </p>
          </div>
        </div>
      </header>

      <div className="chat-messages" ref={scrollRef}>
        <div style={{ height: totalSize, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, width: '100%',
              transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
            }}
          >
            {virtualItems.map((vRow) => {
              const item = flatItems[vRow.index];
              return (
                <div
                  key={item.key}
                  data-index={vRow.index}
                  ref={virtualizer.measureElement}
                  style={{ padding: '0 20px' }}
                >
                  <VirtualRow item={item} mediaMap={mediaMap} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
