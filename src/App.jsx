import { useState, useCallback } from 'react';
import { HeroUpload } from './components/ui/hero-dithering-card.tsx';
import ChatViewer from './components/ChatViewer.jsx';

export default function App() {
  const [chatData, setChatData] = useState(null);

  const handleParsed = useCallback(({ messages, mediaMap }, fileName) => {
    setChatData({ messages, mediaMap, fileName });
  }, []);

  const handleReset = useCallback(() => {
    // SECURITY: revoke all blob URLs to free memory and prevent leaks
    if (chatData?.mediaMap) {
      const seen = new Set();
      for (const entry of Object.values(chatData.mediaMap)) {
        if (entry?.url && !seen.has(entry.url)) {
          seen.add(entry.url);
          URL.revokeObjectURL(entry.url);
        }
      }
    }
    setChatData(null);
  }, [chatData]);

  return (
    <div className="app">
      {chatData ? (
        <ChatViewer
          messages={chatData.messages}
          mediaMap={chatData.mediaMap}
          fileName={chatData.fileName}
          onReset={handleReset}
        />
      ) : (
        <HeroUpload onParsed={handleParsed} />
      )}
    </div>
  );
}
