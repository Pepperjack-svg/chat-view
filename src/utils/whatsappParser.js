import JSZip from 'jszip';

// Strip ALL invisible/directional unicode chars from anywhere in the string.
// This covers U+200E (LTR mark), U+200F (RTL mark), U+200B (zero-width space),
// U+FEFF (BOM), U+202A–U+202E (directional formatting), U+2060 (word joiner).
const INVISIBLE_RE = /[\u200e\u200f\u200b\ufeff\u202a-\u202e\u2060]/g;

function clean(str) {
  return str.replace(INVISIBLE_RE, '').trim();
}

// ─── Date: supports / . - as separator ─────────────────────────
const D = '(\\d{1,2}[/\\.\\-]\\d{1,2}[/\\.\\-]\\d{2,4})';

// ─── Time: 12h with optional seconds, optional AM/PM (handles narrow no-break space \u202f) ─
const T_IOS = '(\\d{1,2}:\\d{2}(?::\\d{2})?[\\s\u202f]?(?:AM|PM)?)';
const T_AND = '(\\d{1,2}:\\d{2}(?::\\d{2})?[\\s\u202f]?(?:[APap][Mm])?)';

// ─── Dash: hyphen, en-dash, em-dash ────────────────────────────
const DASH = '[\\-\u2013\u2014]';

// ─── Sender: anything that isn't a colon, lazy ─────────────────
const SENDER = '([^:]+?)';

// iOS:     [DD/MM/YY, H:MM:SS AM] Sender: Message
const IOS_MSG_RE = new RegExp(
  `^\\[${D},\\s${T_IOS}\\]\\s${SENDER}:\\s([\\s\\S]*)$`, 'i'
);

// iOS system (no Sender:): [DD/MM/YY, H:MM:SS AM] Some notification text
const IOS_SYS_RE = new RegExp(
  `^\\[${D},\\s${T_IOS}\\]\\s(.+)$`, 'i'
);

// Android: DD/MM/YY, H:MM AM - Sender: Message
const AND_MSG_RE = new RegExp(
  `^${D},\\s${T_AND}\\s${DASH}\\s${SENDER}:\\s([\\s\\S]*)$`
);

// Android system (no Sender:): DD/MM/YY, H:MM AM - Some text
const AND_SYS_RE = new RegExp(
  `^${D},\\s${T_AND}\\s${DASH}\\s(.+)$`
);

// ─── Media / attachment patterns ────────────────────────────────
const MEDIA_PLACEHOLDER_RE = /^<?(Media omitted|image omitted|video omitted|audio omitted|sticker omitted|document omitted|GIF omitted|Contact card omitted|null)>?$/i;
const IOS_ATTACH_RE   = /^<attached:\s*(.+?)>$/i;             // <attached: file.jpg>
const AND_ATTACH_RE   = /^(.+?)\s\(file attached\)$/i;        // file.jpg (file attached)
const AND_ATTACH2_RE  = /^(.+?)\s\(fichier joint\)$/i;        // French variant
const DELETED_RE      = /^(This message was deleted|You deleted this message)$/i;

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|svg|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|mov|avi|mkv|webm|3gp)$/i;
const AUDIO_EXT = /\.(mp3|m4a|ogg|opus|wav|aac|amr)$/i;

function makeMsg(date, time, sender, text) {
  return {
    date: clean(date),
    time: clean(time),
    sender: clean(sender),
    text: clean(text),
    isSystem: false,
    mediaFilename: null,
    mediaOmitted: false,
    deleted: false,
  };
}

function makeSys(date, time, text) {
  return {
    date: clean(date),
    time: clean(time),
    sender: null,
    text: clean(text),
    isSystem: true,
    mediaFilename: null,
    mediaOmitted: false,
    deleted: false,
  };
}

// ─── Core line parser ────────────────────────────────────────────
function parseLines(lines) {
  const messages = [];
  let current = null;

  for (const rawLine of lines) {
    // Strip invisible chars from the ENTIRE line before matching
    const line = rawLine.replace(INVISIBLE_RE, '');
    if (!line.trim()) {
      // Blank line — treat as continuation (preserves paragraph breaks in messages)
      if (current) current.text += '\n';
      continue;
    }

    const iosMsg = line.match(IOS_MSG_RE);
    const andMsg = !iosMsg && line.match(AND_MSG_RE);

    if (iosMsg) {
      if (current) messages.push(current);
      // Groups: 1=date, 2=time, 3=sender, 4=text
      current = makeMsg(iosMsg[1], iosMsg[2], iosMsg[3], iosMsg[4]);
      continue;
    }

    if (andMsg) {
      if (current) messages.push(current);
      // Groups: 1=date, 2=time, 3=sender, 4=text
      current = makeMsg(andMsg[1], andMsg[2], andMsg[3], andMsg[4]);
      continue;
    }

    // Not a new message — check if it's a timestamp-only system line
    const iosSys  = line.match(IOS_SYS_RE);
    const andSys  = !iosSys && line.match(AND_SYS_RE);

    if (iosSys || andSys) {
      if (current) messages.push(current);
      current = null;
      const m = iosSys || andSys;
      messages.push(makeSys(m[1], m[2], m[3]));
      continue;
    }

    // Continuation of current message (multi-line text)
    if (current) {
      current.text += '\n' + line;
    }
    // else: preamble junk before the first message — ignore
  }

  if (current) messages.push(current);

  // ─── Post-process: classify attachments / media ──────────────
  for (const msg of messages) {
    if (msg.isSystem) continue;

    const t = msg.text.trim();

    if (MEDIA_PLACEHOLDER_RE.test(t)) {
      msg.mediaOmitted = true;
      msg.text = '';
      continue;
    }

    if (DELETED_RE.test(t)) {
      msg.deleted = true;
      msg.text = t;
      continue;
    }

    // iOS: <attached: filename.ext>
    const iosAt = t.match(IOS_ATTACH_RE);
    if (iosAt) {
      msg.mediaFilename = iosAt[1].trim();
      msg.text = '';
      continue;
    }

    // Android: filename (file attached)
    const andAt = t.match(AND_ATTACH_RE) || t.match(AND_ATTACH2_RE);
    if (andAt) {
      msg.mediaFilename = andAt[1].trim();
      msg.text = '';
    }
  }

  return messages;
}

// ─── Public API ──────────────────────────────────────────────────
export async function parseFile(file) {
  const name = file.name.toLowerCase();
  // Case-insensitive filename -> { url, type }
  const mediaMap = {};

  // ── Helper: extract all media from a JSZip instance ──────────
  async function extractMedia(zip) {
    for (const zf of Object.values(zip.files)) {
      if (zf.dir) continue;
      // Guard against path traversal attacks in ZIP entry names
      if (zf.name.includes('..') || zf.name.startsWith('/') || zf.name.startsWith('\\')) continue;
      const base = zf.name.split('/').pop();
      if (!base) continue;
      let type = null;
      if (IMAGE_EXT.test(base)) type = 'image';
      else if (VIDEO_EXT.test(base)) type = 'video';
      else if (AUDIO_EXT.test(base)) type = 'audio';
      if (!type) continue;
      const blob = await zf.async('blob');
      const url = URL.createObjectURL(blob);
      mediaMap[base] = { url, type };
      mediaMap[base.toLowerCase()] = { url, type };
    }
  }

  // ── Telegram JSON file ────────────────────────────────────────
  if (name.endsWith('.json')) {
    const { parseTelegramJson, isTelegramExport } = await import('./telegramParser.js');
    const data = JSON.parse(await file.text());
    if (!isTelegramExport(data)) throw new Error('Not a recognised Telegram export JSON.');
    const messages = parseTelegramJson(data, mediaMap);
    return { messages, mediaMap, source: 'telegram' };
  }

  // ── ZIP — detect WhatsApp vs Telegram vs Instagram ────────────
  if (name.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file);
    await extractMedia(zip);

    // Instagram ZIP contains your_instagram_activity/messages/inbox/<thread>/message_N.html
    const { isInstagramZip, listInstagramThreads, parseInstagramThread } = await import('./instagramParser.js');
    if (isInstagramZip(zip)) {
      const threads = await listInstagramThreads(zip);
      if (threads.length === 0) throw new Error('No Instagram conversations found in this export.');
      if (threads.length === 1) {
        const messages = await parseInstagramThread(zip, threads[0].id, mediaMap);
        return { messages, mediaMap, source: 'instagram', fileNameOverride: threads[0].title };
      }
      return { needsThreadSelection: true, source: 'instagram', threads, zip, mediaMap };
    }

    // Telegram ZIP contains result.json
    const tgJson = Object.values(zip.files).find((f) => !f.dir && /result\.json$/i.test(f.name));
    if (tgJson) {
      const { parseTelegramJson, isTelegramExport } = await import('./telegramParser.js');
      const data = JSON.parse(await tgJson.async('string'));
      if (isTelegramExport(data)) {
        const messages = parseTelegramJson(data, mediaMap);
        return { messages, mediaMap, source: 'telegram' };
      }
    }

    // WhatsApp ZIP contains _chat.txt
    const txtFile =
      Object.values(zip.files).find((f) => !f.dir && /_chat\.txt$/i.test(f.name)) ||
      Object.values(zip.files).find((f) => !f.dir && /\.txt$/i.test(f.name));
    if (!txtFile) throw new Error('No chat file found inside the ZIP (expected _chat.txt or result.json).');
    const chatText = await txtFile.async('string');
    const lines = chatText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const messages = parseLines(lines);
    return { messages, mediaMap, source: 'whatsapp' };
  }

  // ── Plain TXT ─────────────────────────────────────────────────
  if (name.endsWith('.txt')) {
    const chatText = await file.text();
    const lines = chatText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const messages = parseLines(lines);
    return { messages, mediaMap, source: 'whatsapp' };
  }

  throw new Error('Unsupported file. Upload a WhatsApp .zip/.txt, Telegram .zip/.json, or Instagram .zip export.');
}
