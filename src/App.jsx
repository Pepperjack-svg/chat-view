import { useState, useCallback } from 'react';
import { HeroUpload } from './components/ui/hero-dithering-card.tsx';
import ChatViewer from './components/ChatViewer.jsx';
import InstagramThreadPicker from './components/InstagramThreadPicker.jsx';

function revokeMediaMap(mediaMap) {
  if (!mediaMap) return;
  const seen = new Set();
  for (const entry of Object.values(mediaMap)) {
    if (entry?.url && !seen.has(entry.url)) {
      seen.add(entry.url);
      URL.revokeObjectURL(entry.url);
    }
  }
}

export default function App() {
  const [chatData, setChatData] = useState(null);
  // Set when an Instagram export contains multiple conversations and the
  // user needs to pick one before we can build the final chatData.
  const [pending, setPending] = useState(null);

  const handleParsed = useCallback((result, fileName) => {
    if (result.needsThreadSelection) {
      setPending({ threads: result.threads, zip: result.zip, mediaMap: result.mediaMap });
      return;
    }
    setChatData({
      messages: result.messages,
      mediaMap: result.mediaMap,
      fileName: result.fileNameOverride || fileName,
    });
  }, []);

  const handleThreadSelected = useCallback(({ messages, mediaMap, fileName }) => {
    // Keep `pending` alive so the chat's back button can return to the picker
    // instead of discarding the whole parsed export to re-pick a conversation.
    setChatData({ messages, mediaMap, fileName });
  }, []);

  const handlePickerBack = useCallback(() => {
    revokeMediaMap(pending?.mediaMap);
    setPending(null);
  }, [pending]);

  const handleReset = useCallback(() => {
    if (pending) {
      // Came from an Instagram export with multiple conversations — return to
      // the picker rather than discarding the shared zip/mediaMap.
      setChatData(null);
      return;
    }
    revokeMediaMap(chatData?.mediaMap);
    setChatData(null);
  }, [chatData, pending]);

  return (
    <div className="app">
      {chatData ? (
        <ChatViewer
          messages={chatData.messages}
          mediaMap={chatData.mediaMap}
          fileName={chatData.fileName}
          onReset={handleReset}
        />
      ) : pending ? (
        <InstagramThreadPicker
          threads={pending.threads}
          zip={pending.zip}
          mediaMap={pending.mediaMap}
          onSelect={handleThreadSelected}
          onBack={handlePickerBack}
        />
      ) : (
        <HeroUpload onParsed={handleParsed} />
      )}
    </div>
  );
}
