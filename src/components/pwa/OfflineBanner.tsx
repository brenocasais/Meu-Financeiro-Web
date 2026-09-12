import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      id="banner-offline-mode"
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-[#F59E0B] dark:bg-[#FF9F1C] px-3 py-1.5 text-xs font-semibold text-[#111827] shadow-md"
    >
      <WifiOff className="w-4 h-4" />
      <span>Modo Offline — O app continuará com dados em cache.</span>
    </div>
  );
};
