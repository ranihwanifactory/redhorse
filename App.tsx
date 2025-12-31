
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import Auth from './components/Auth';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';

const Intro: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <div className="fixed inset-0 z-50 fire-bg flex flex-col items-center justify-center p-6 text-white overflow-hidden">
    <div className="relative mb-12 intro-horse">
      <span className="text-9xl filter drop-shadow-2xl">🐎</span>
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/20 rounded-full blur-md"></div>
    </div>
    <h1 className="text-6xl md:text-8xl font-black mb-2 tracking-tighter drop-shadow-lg text-center">
      2026<br/><span className="text-yellow-300">병오년</span>
    </h1>
    <h2 className="text-3xl md:text-4xl font-bold mb-12 text-orange-100 drop-shadow">대박 말달리기 대결</h2>
    
    <button 
      onClick={onStart}
      className="animate-pulse-custom bg-yellow-400 hover:bg-yellow-300 text-red-700 text-3xl font-black px-12 py-5 rounded-full shadow-2xl transform transition active:scale-90"
    >
      게임 시작!
    </button>
    
    <div className="absolute bottom-10 text-orange-200 text-sm font-bold opacity-80">
      새해 복 많이 받으세요! 🧧
    </div>
  </div>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/room/')) {
        const id = hash.replace('#/room/', '');
        setCurrentRoomId(id);
        setShowIntro(false); // Skip intro if joining via link
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

  if (showIntro && !currentRoomId) {
    return <Intro onStart={() => setShowIntro(false)} />;
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
