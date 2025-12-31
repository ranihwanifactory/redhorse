
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import Auth from './components/Auth';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  useEffect(() => {
    // Handle room ID from URL hash
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/room/')) {
        const id = hash.replace('#/room/', '');
        setCurrentRoomId(id);
      } else {
        setCurrentRoomId(null);
      }
    };

    window.addEventListener('hashchange', handleHash);
    handleHash();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl animate-bounce mb-4">🐎</div>
          <p className="text-red-600 font-bold text-xl">Loading New Year Energy...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-orange-50 font-sans">
      {currentRoomId ? (
        <GameRoom user={user} roomId={currentRoomId} onLeave={() => window.location.hash = ''} />
      ) : (
        <Lobby user={user} />
      )}
    </div>
  );
};

export default App;
