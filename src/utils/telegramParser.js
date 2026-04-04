// Parses Telegram exported chat (result.json format)

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif|svg)$/i;
const VIDEO_EXT = /\.(mp4|mov|avi|mkv|webm|3gp)$/i;
const AUDIO_EXT = /\.(mp3|m4a|ogg|opus|wav|aac|amr|oga)$/i;

// Telegram text can be a string or an array of text-entity objects
function extractText(raw) {
  if (typeof raw === 'string') return raw;
  if (!Array.isArray(raw)) return '';
  return raw
    .map((part) => (typeof part === 'string' ? part : part.text || ''))
    .join('');
}

// Convert "2024-03-18T14:02:05" → { date: "18/03/24", time: "14:02:05" }
function parseDate(iso) {
  try {
    const [datePart, timePart = '00:00:00'] = iso.split('T');
    const [year, month, day] = datePart.split('-');
    const yy = year.slice(2);
    return { date: `${day}/${month}/${yy}`, time: timePart.slice(0, 8) };
  } catch {
    return { date: iso, time: '' };
  }
}

function mediaTypeFromPath(path) {
  if (!path) return null;
  if (IMAGE_EXT.test(path)) return 'image';
  if (VIDEO_EXT.test(path)) return 'video';
  if (AUDIO_EXT.test(path)) return 'audio';
  return 'file';
}

export function parseTelegramJson(data, mediaMap = {}) {
  const rawMessages = data.messages || [];
  const messages = [];

  for (const m of rawMessages) {
    const { date, time } = parseDate(m.date || '');

    // Service / system messages
    if (m.type === 'service') {
      let sysText = m.action || 'System message';
      if (m.actor) sysText = `${m.actor}: ${sysText}`;
      messages.push({ date, time, sender: null, text: String(sysText), isSystem: true, mediaFilename: null, mediaOmitted: false, deleted: false });
      continue;
    }

    if (m.type !== 'message') continue;

    const sender = m.from || m.actor || 'Unknown';
    let text = extractText(m.text).trim();
    let mediaFilename = null;
    let mediaOmitted = false;

    // Photo
    if (m.photo && typeof m.photo === 'string') {
      const base = m.photo.split('/').pop();
      if (base && (mediaMap[base] || mediaMap[base.toLowerCase()])) {
        mediaFilename = base;
      } else {
        mediaOmitted = true;
      }
    }
    // Video / file / document / sticker / voice / audio
    else if (m.file && typeof m.file === 'string') {
      const base = m.file.split('/').pop();
      if (base) {
        if (mediaMap[base] || mediaMap[base.toLowerCase()]) {
          mediaFilename = base;
        } else {
          mediaFilename = base;
          if (!text) mediaOmitted = true;
        }
      }
    }

    // Deleted / unsupported
    const deleted = (m.text === '' || text === '') && !m.photo && !m.file && m.id;

    messages.push({
      date,
      time,
      sender,
      text,
      isSystem: false,
      mediaFilename,
      mediaOmitted,
      deleted: false,
    });
  }

  return messages;
}

export function isTelegramExport(data) {
  // Telegram JSON has a top-level "messages" array with objects that have "id" and "type"
  return (
    data &&
    Array.isArray(data.messages) &&
    data.messages.length > 0 &&
    ('from' in data.messages[0] || 'actor' in data.messages[0] || 'type' in data.messages[0])
  );
}
