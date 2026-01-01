
import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import Auth from './components/Auth';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';

// Audio sources
const LOBBY_BGM = "https://cdn.pixabay.com/audio/2022/05/27/audio_1ab7a7d0e4.mp3"; // Upbeat joyful
const CLICK_SFX = "https://cdn.pixabay.com/audio/2022/03/15/audio_73060c1d63.mp3"; // Pop/Click

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
  const [isMuted, setIsMuted] = useState(false);
  
  const bgmRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/room/')) {
        const id = hash.replace('#/room/', '');
        setCurrentRoomId(id);
        setShowIntro(false);
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

  useEffect(() => {
    if (!showIntro && user && !currentRoomId) {
      if (!bgmRef.current) {
        bgmRef.current = new Audio(LOBBY_BGM);
        bgmRef.current.loop = true;
        bgmRef.current.volume = 0.4;
      }
      if (!isMuted) {
        bgmRef.current.play().catch(console.error);
      } else {
        bgmRef.current.pause();
      }
    } else if (currentRoomId || !user) {
      bgmRef.current?.pause();
    }
    
    return () => bgmRef.current?.pause();
  }, [showIntro, user, currentRoomId, isMuted]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
    new Audio(CLICK_SFX).play().catch(() => {});
  };

  const startWithSound = () => {
    setShowIntro(false);
    const silentPlay = new Audio(CLICK_SFX);
    silentPlay.play().catch(() => {});
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl animate-bounce mb-4">🐎</div>
          <p className="text-red-600 font-bold text-xl">새해 기운 모으는 중...</p>
        </div>
      </div>
    );
  }

  if (showIntro && !currentRoomId) {
    return <Intro onStart={startWithSound} />;
  }

  return (
    <div className="min-h-screen bg-orange-50 font-sans relative">
      {/* Global Mute Toggle - Moved to bottom-left to avoid header overlap */}
      {user && (
        <button 
          onClick={toggleMute}
          className="fixed bottom-6 left-6 z-50 bg-white/90 p-3 rounded-full shadow-xl border-2 border-orange-200 hover:bg-white transition-all active:scale-90"
          aria-label="Toggle Mute"
        >
          {isMuted ? (
            <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          ) : (
            <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" /></svg>
          )}
        </button>
      )}

      {!user ? (
        <Auth />
      ) : currentRoomId ? (
        <GameRoom user={user} roomId={currentRoomId} onLeave={() => window.location.hash = ''} isMuted={isMuted} />
      ) : (
        <Lobby user={user} isMuted={isMuted} />
      )}
    </div>
  );
};

export default App;
