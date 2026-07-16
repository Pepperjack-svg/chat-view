// Parses Instagram exported chats (HTML format from "Download Your Information")
//
// Export layout: your_instagram_activity/messages/inbox/<thread_id>/message_N.html
// Each message is a `._a6-g` container with three direct children:
//   `._a6-h` sender name, `._a6-p` content (text/media/shared-post captions), `._a6-o` timestamp.
// These class names were confirmed against a real export and have been stable across
// Instagram's export tooling; the parser still guards against missing pieces so a future
// markup change degrades to "skip that row" rather than crashing the whole import.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const TIMESTAMP_RE = /^([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)?$/i;
const AUDIO_PATH_RE = /\/audio\//i;
const SKIP_TAGS = new Set(['UL', 'IMG', 'VIDEO', 'AUDIO']);

function parseTimestamp(raw) {
  const m = raw.trim().match(TIMESTAMP_RE);
  if (!m) return { date: raw.trim(), time: '', ts: 0 };
  const [, mon, day, year, hh, mm, ampm] = m;
  const monthIdx = MONTHS.indexOf(mon.slice(0, 3).toLowerCase());
  const hour24 = (Number(hh) % 12) + (ampm && ampm.toLowerCase() === 'pm' ? 12 : 0);
  const ts = new Date(Number(year), monthIdx, Number(day), hour24, Number(mm)).getTime();
  const dd = String(day).padStart(2, '0');
  const moStr = String(monthIdx + 1).padStart(2, '0');
  const yy = String(year).slice(2);
  const time = `${hh}:${mm}${ampm ? ' ' + ampm.toLowerCase() : ''}`;
  return { date: `${dd}/${moStr}/${yy}`, time, ts };
}

// Recursively collects text from leaf elements only (so nested wrapper divs
// don't duplicate their children's text), skipping reaction lists and media tags.
function collectLeafText(el, out) {
  if (SKIP_TAGS.has(el.tagName)) return;
  const children = Array.from(el.children).filter((c) => !SKIP_TAGS.has(c.tagName));
  if (children.length === 0) {
    const t = el.textContent.trim();
    if (t) out.push(t);
    return;
  }
  for (const c of children) collectLeafText(c, out);
}

// Lightweight entity decode (titles are harvested via regex, not DOMParser,
// so &#064; / &amp; etc. need decoding by hand).
function decodeEntities(str) {
  const el = document.createElement('textarea');
  el.innerHTML = str;
  return el.value;
}

// Instagram lets you send several photos (and/or a video) as one burst inside
// a single message container, so this returns every media element found —
// not just the first — each becomes its own bubble in parseThreadHtml.
function extractMediaList(contentEl) {
  const mediaEls = Array.from(contentEl.querySelectorAll('img, video, audio'));
  const out = [];
  for (const el of mediaEls) {
    const src = el.getAttribute('src');
    if (!src) continue;
    out.push({ basename: src.split('/').pop(), isAudioPath: AUDIO_PATH_RE.test(src) });
  }
  return out;
}

function parseThreadHtml(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  const containers = doc.querySelectorAll('._a6-g');
  const messages = [];

  for (const container of containers) {
    const children = Array.from(container.children);
    const senderEl = children.find((c) => c.classList.contains('_a6-h'));
    const contentEl = children.find((c) => c.classList.contains('_a6-p'));
    const timeEl = children.find((c) => c.classList.contains('_a6-o'));
    if (!senderEl || !contentEl || !timeEl) continue;

    const sender = senderEl.textContent.trim();
    const { date, time, ts } = parseTimestamp(timeEl.textContent);
    const mediaList = extractMediaList(contentEl);

    if (mediaList.length === 0) {
      const textParts = [];
      collectLeafText(contentEl, textParts);
      messages.push({
        date,
        time,
        sender,
        text: textParts.join('\n').trim(),
        isSystem: false,
        mediaFilename: null,
        mediaOmitted: false,
        deleted: false,
        _ts: ts,
        _audioHint: false,
      });
      continue;
    }

    // One bubble per attachment, in DOM order (Array.sort is stable, so equal
    // timestamps later won't reshuffle a burst back out of order).
    for (const media of mediaList) {
      messages.push({
        date,
        time,
        sender,
        text: '',
        isSystem: false,
        mediaFilename: media.basename,
        mediaOmitted: false,
        deleted: false,
        _ts: ts,
        _audioHint: media.isAudioPath,
      });
    }
  }

  return messages;
}

function threadFileRegex(threadId) {
  return new RegExp(`your_instagram_activity/messages/inbox/${threadId}/message_(\\d+)\\.html$`, 'i');
}

function messageFileNumber(name) {
  const m = name.match(/message_(\d+)\.html$/i);
  return m ? Number(m[1]) : 0;
}

export function isInstagramZip(zip) {
  return Object.keys(zip.files).some((name) =>
    /your_instagram_activity\/messages\/inbox\/[^/]+\/message_\d+\.html$/i.test(name)
  );
}

// Returns [{ id, title, messageCount }] for every conversation folder found,
// sorted by message count (most active conversation first).
export async function listInstagramThreads(zip) {
  const byThread = new Map();
  for (const name of Object.keys(zip.files)) {
    const m = name.match(/your_instagram_activity\/messages\/inbox\/([^/]+)\/message_\d+\.html$/i);
    if (!m) continue;
    if (!byThread.has(m[1])) byThread.set(m[1], []);
    byThread.get(m[1]).push(name);
  }

  const threads = [];
  for (const [threadId, fileNames] of byThread) {
    fileNames.sort((a, b) => messageFileNumber(a) - messageFileNumber(b));
    let title = threadId;
    let messageCount = 0;
    for (let i = 0; i < fileNames.length; i++) {
      const text = await zip.files[fileNames[i]].async('string');
      if (i === 0) {
        const titleMatch = text.match(/<title>([\s\S]*?)<\/title>/i);
        if (titleMatch && titleMatch[1].trim()) title = decodeEntities(titleMatch[1].trim());
      }
      messageCount += (text.match(/_a6-g/g) || []).length;
    }
    threads.push({ id: threadId, title, messageCount });
  }

  threads.sort((a, b) => b.messageCount - a.messageCount);
  return threads;
}

// Parses one conversation's message_N.html files (in chronological order) and,
// since Instagram voice notes are exported as .mp4 under an audio/ folder
// (indistinguishable by extension from real videos), corrects mediaMap's type
// for any file that was actually referenced from an <audio> tag.
export async function parseInstagramThread(zip, threadId, mediaMap) {
  const re = threadFileRegex(threadId);
  const fileNames = Object.keys(zip.files)
    .filter((name) => re.test(name))
    .sort((a, b) => messageFileNumber(a) - messageFileNumber(b));

  let messages = [];
  for (const name of fileNames) {
    const htmlText = await zip.files[name].async('string');
    messages = messages.concat(parseThreadHtml(htmlText));
  }

  messages.sort((a, b) => a._ts - b._ts);

  for (const m of messages) {
    if (m._audioHint && m.mediaFilename) {
      const base = m.mediaFilename;
      const lower = base.toLowerCase();
      if (mediaMap[base]) mediaMap[base] = { ...mediaMap[base], type: 'audio' };
      if (mediaMap[lower]) mediaMap[lower] = { ...mediaMap[lower], type: 'audio' };
    }
    delete m._ts;
    delete m._audioHint;
  }

  return messages;
}
