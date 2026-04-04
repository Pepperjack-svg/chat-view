import { useRef, useState } from 'react';
import { Upload, FileArchive, FileText, Loader2 } from 'lucide-react';

export default function FileUpload({ onParsed }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleFile(file) {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const { parseFile } = await import('../utils/whatsappParser.js');
      const result = await parseFile(file);
      onParsed(result, file.name);
    } catch (e) {
      setError(e.message || 'Failed to parse file.');
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }

  function onInputChange(e) {
    handleFile(e.target.files[0]);
  }

  return (
    <div className="upload-screen">
      <div className="upload-hero">
        <div className="upload-logo">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <circle cx="26" cy="26" r="26" fill="url(#grad)" />
            <path d="M26 13C18.82 13 13 18.82 13 26c0 2.3.6 4.46 1.64 6.34L13 39l6.84-1.6A13 13 0 1 0 26 13Z" fill="white" fillOpacity="0.9"/>
            <path d="M22 21.5c-.28-.62-.57-.63-.83-.64l-.7-.01c-.25 0-.64.09-.98.47-.33.37-1.27 1.24-1.27 3.03 0 1.78 1.3 3.51 1.48 3.75.18.25 2.52 4.02 6.2 5.47 3.07 1.21 3.69.97 4.35.91.66-.06 2.13-.87 2.43-1.71.3-.84.3-1.56.21-1.71-.09-.15-.33-.24-.7-.42-.36-.18-2.13-1.05-2.46-1.17-.33-.12-.57-.18-.81.18-.24.37-.93 1.17-1.14 1.41-.21.24-.42.27-.78.09-.36-.18-1.52-.56-2.9-1.79-1.07-.95-1.79-2.13-2-2.49-.21-.36-.02-.56.16-.74.16-.16.36-.42.54-.63.18-.21.24-.36.36-.6.12-.24.06-.45-.03-.63-.09-.18-.79-1.97-1.11-2.71Z" fill="url(#grad2)"/>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#25D366"/>
                <stop offset="1" stopColor="#128C7E"/>
              </linearGradient>
              <linearGradient id="grad2" x1="13" y1="13" x2="39" y2="39" gradientUnits="userSpaceOnUse">
                <stop stopColor="#128C7E"/>
                <stop offset="1" stopColor="#25D366"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 className="upload-title">WhatsApp Chat Viewer</h1>
        <p className="upload-subtitle">
          Drop your exported chat to relive your conversations — privately, in your browser.
        </p>
      </div>

      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,.txt"
          style={{ display: 'none' }}
          onChange={onInputChange}
        />
        {loading ? (
          <div className="dropzone-inner">
            <Loader2 size={40} className="spin" strokeWidth={1.5} />
            <p>Parsing your chat…</p>
          </div>
        ) : (
          <div className="dropzone-inner">
            <Upload size={40} strokeWidth={1.5} />
            <p className="dropzone-main">Click or drag &amp; drop your export</p>
            <p className="dropzone-sub">Supports <span>.zip</span> and <span>.txt</span> WhatsApp exports</p>
            <div className="format-badges">
              <span className="badge"><FileArchive size={13} /> ZIP with media</span>
              <span className="badge"><FileText size={13} /> Plain text</span>
            </div>
          </div>
        )}
      </div>

      {error && <p className="upload-error">{error}</p>}

      <p className="privacy-note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        100% private — your data never leaves your device.
      </p>
    </div>
  );
}
