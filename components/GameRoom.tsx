import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';
import { ref, onValue, set, remove, onDisconnect, update, get, runTransaction } from 'firebase/database';
import { db } from '../firebase';
import { Room, Player, GameStatus } from '../types';

interface GameRoomProps {
  user: User;
  roomId: string;
  onLeave: () => void;
  isMuted?: boolean;
}

const horseColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

// Audio Assets
const RACE_BGM = "https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3"; 
const GALLOP_SFX = "https://cdn.pixabay.com/audio/2022/03/10/audio_c3527855b3.mp3"; 
const COUNTDOWN_SFX = "https://cdn.pixabay.com/audio/2021/08/09/audio_8816d77351.mp3"; 
const WIN_SFX = "https://cdn.pixabay.com/audio/2021/08/04/audio_0625c151cc.mp3"; 
const READY_SFX = "https://cdn.pixabay.com/audio/2022/03/15/audio_73060c1d63.mp3"; 

const GameRoom: React.FC<GameRoomProps> = ({ user, roomId, onLeave, isMuted = false }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [localCountdown, setLocalCountdown] = useState<number | null>(null);
  const [showTapEffect, setShowTapEffect] = useState(false);
  const [hasRecordedResult, setHasRecordedResult] = useState(false);
  
  const roomRef = ref(db, `rooms/${roomId}`);
  
  // Audio Refs
  const raceBgmRef = useRef<HTMLAudioElement | null>(null);
  const gallopPool = useRef<HTMLAudioElement[]>([]);
  const poolIndex = useRef(0);

  useEffect(() => {
    if (gallopPool.current.length === 0) {
      for (let i = 0; i < 15; i++) {
        const audio = new Audio(GALLOP_SFX);
        audio.volume = 0.4;
        gallopPool.current.push(audio);
      }
    }
    
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        onLeave();
        return;
      }
      setRoom({ id: roomId, ...data });
    });

    return () => {
      unsubscribe();
      raceBgmRef.current?.pause();
    };
  }, [roomId, onLeave]);

  useEffect(() => {
    if (!room) return;
    const players = room.players || {};
    if (!players[user.uid] && Object.keys(players).length < 4 && room.status === 'waiting') {
      const playerRef = ref(db, `rooms/${roomId}/players/${user.uid}`);
      set(playerRef, {
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Player',
        photoURL: user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`,
        progress: 0,
        isReady: false,
        score: 0,
        horseColor: horseColors[Math.floor(Math.random() * horseColors.length)]
      });
    }
  }, [room?.status, room?.players, roomId, user]);

  useEffect(() => {
    if (room && room.hostId === user.uid) {
      onDisconnect(roomRef).remove();
    }
  }, [room?.hostId, user.uid, roomRef]);

  // Record Win/Loss only once when game finishes
  useEffect(() => {
    if (room?.status === 'finished' && room.winnerId && !hasRecordedResult) {
      setHasRecordedResult(true);
      // Explicitly cast Object.values to Player[] to avoid 'unknown' type errors during iteration.
      const players = Object.values(room.players || {}) as Player[];
      
      players.forEach(async (p) => {
        const isWinner = p.uid === room.winnerId;
        const rankingRef = ref(db, `rankings/${p.uid}`);
        
        await runTransaction(rankingRef, (currentData) => {
          if (currentData === null) {
            return {
              uid: p.uid,
              name: p.name,
              photoURL: p.photoURL,
              wins: isWinner ? 1 : 0,
              losses: isWinner ? 0 : 1,
              lastUpdated: Date.now()
            };
          } else {
            return {
              ...currentData,
              wins: isWinner ? (currentData.wins || 0) + 1 : (currentData.wins || 0),
              losses: isWinner ? (currentData.losses || 0) : (currentData.losses || 0) + 1,
              lastUpdated: Date.now()
            };
          }
        });
      });
    } else if (room?.status === 'waiting') {
      setHasRecordedResult(false);
    }
  }, [room?.status, room?.winnerId, room?.players, hasRecordedResult]);

  useEffect(() => {
    if (!room) return;
    if (room.status === 'playing') {
      if (!raceBgmRef.current) {
        raceBgmRef.current = new Audio(RACE_BGM);
        raceBgmRef.current.loop = true;
        raceBgmRef.current.volume = 0.5;
      }
      if (!isMuted) raceBgmRef.current.play().catch(() => {});
    } else {
      raceBgmRef.current?.pause();
    }

    if (room.status === 'finished') {
      if (!isMuted) {
        const winAudio = new Audio(WIN_SFX);
        winAudio.volume = 0.6;
        winAudio.play().catch(() => {});
      }
    }
  }, [room?.status, isMuted]);

  useEffect(() => {
    if (raceBgmRef.current) {
      if (isMuted) raceBgmRef.current.pause();
      else if (room?.status === 'playing') raceBgmRef.current.play().catch(() => {});
    }
  }, [isMuted, room?.status]);

  useEffect(() => {
    if (room?.status === 'starting') {
      setLocalCountdown(3);
      if (!isMuted) {
        const beep = new Audio(COUNTDOWN_SFX);
        beep.play().catch(() => {});
      }
      
      const interval = setInterval(() => {
        setLocalCountdown((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(interval);
            if (room.hostId === user.uid) {
              update(roomRef, { status: 'playing' });
            }
            return null;
          }
          if (!isMuted) {
            const beep = new Audio(COUNTDOWN_SFX);
            beep.play().catch(() => {});
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setLocalCountdown(null);
    }
  }, [room?.status, room?.hostId, user.uid, isMuted]);

  const playSfx = (url: string, vol = 0.5) => {
    if (isMuted) return;
    const sfx = new Audio(url);
    sfx.volume = vol;
    sfx.play().catch(() => {});
  };

  const playGallop = () => {
    if (isMuted) return;
    const audio = gallopPool.current[poolIndex.current];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      poolIndex.current = (poolIndex.current + 1) % gallopPool.current.length;
    }
  };

  const toggleReady = () => {
    if (!room || !room.players?.[user.uid]) return;
    playSfx(READY_SFX);
    const playerRef = ref(db, `rooms/${roomId}/players/${user.uid}/isReady`);
    set(playerRef, !room.players[user.uid].isReady);
  };

  const startGame = () => {
    if (!room) return;
    update(roomRef, { status: 'starting' });
  };

  const handleTap = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      if ('preventDefault' in e) e.preventDefault();
    }
    
    if (!room || room.status !== 'playing' || room.winnerId) return;

    const currentPlayer = room.players?.[user.uid];
    if (!currentPlayer) return;

    playGallop();

    const newProgress = Math.min(currentPlayer.progress + 0.35, 100);
    const updates: any = {};
    updates[`players/${user.uid}/progress`] = newProgress;

    if (newProgress >= 100 && !room.winnerId) {
      updates['status'] = 'finished';
      updates['winnerId'] = user.uid;
    }

    update(roomRef, updates);
    
    setShowTapEffect(true);
    setTimeout(() => setShowTapEffect(false), 60);
  }, [room, roomRef, user.uid, isMuted]);

  const resetGame = () => {
    if (!room || !room.players) return;
    playSfx(READY_SFX);
    const playersUpdate: any = {};
    Object.keys(room.players).forEach(uid => {
      playersUpdate[`players/${uid}/progress`] = 0;
      playersUpdate[`players/${uid}/isReady`] = false;
    });
    update(roomRef, {
      ...playersUpdate,
      status: 'waiting',
      winnerId: null
    });
  };

  const shareRoom = async () => {
    playSfx(READY_SFX);
    const shareData = {
      title: '2026 병오년 말달리기',
      text: `${user.displayName || '친구'}님이 경기장에 초대했습니다! 함께 달려보아요!`,
      url: `${window.location.origin}${window.location.pathname}#/room/${roomId}`,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
        alert('링크가 복사되었습니다!');
      }
    } catch (err) {}
  };

  const handleManualLeave = async () => {
    if (room && room.hostId === user.uid) {
      if (confirm('방장이 나가면 방이 사라집니다. 정말 나가시겠습니까?')) {
        await remove(roomRef);
        onLeave();
      }
    } else {
      if (room) {
          const playerRef = ref(db, `rooms/${roomId}/players/${user.uid}`);
          await remove(playerRef);
      }
      onLeave();
    }
  };

  if (!room) return (
    <div className="flex items-center justify-center h-screen bg-orange-50">
      <div className="text-center">
        <div className="text-6xl animate-bounce mb-4">🐎</div>
        <p className="text-red-600 font-bold text-xl">경기장 입장 중...</p>
      </div>
    </div>
  );

  const playersList = room.players ? Object.values(room.players) as Player[] : [];
  const isHost = room.hostId === user.uid;
  const allReady = playersList.length >= 1 && playersList.every(p => p.isReady || p.uid === room.hostId);

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-orange-50 select-none">
      {/* Header */}
      <div className="p-3 md:p-4 bg-white shadow-md flex justify-between items-center z-10 border-b-2 border-orange-100">
        <div className="flex items-center gap-1 md:gap-2">
          <button onClick={handleManualLeave} className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-90">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <h2 className="font-bold text-base md:text-lg text-gray-800 truncate max-w-[120px] md:max-w-none">{room.name}</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={shareRoom} className="bg-blue-500 hover:bg-blue-600 text-white px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-bold shadow-sm flex items-center gap-1 transition-all active:scale-95">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
            <span className="hidden sm:inline">초대</span>
          </button>
          {isHost && (
            <button onClick={() => remove(roomRef)} className="bg-red-100 text-red-600 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-colors active:bg-red-200">방삭제</button>
          )}
        </div>
      </div>

      {/* Track Area */}
      <div className="flex-1 relative bg-cover bg-center overflow-hidden flex flex-col justify-center gap-6 md:gap-8 px-4" style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/grass.png')`, backgroundColor: '#34d399' }}>
        {playersList.map((player) => (
          <div key={player.uid} className="relative h-14 md:h-16 w-full bg-white bg-opacity-20 rounded-full border-2 border-white border-dashed">
            <div className="absolute -top-6 left-0 flex items-center gap-2">
                <img src={player.photoURL} className="w-5 h-5 rounded-full border border-white" alt="" />
                <span className="text-white text-[10px] md:text-xs font-bold bg-black bg-opacity-30 px-2 rounded-full truncate max-w-[80px]">{player.name}</span>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-6 md:w-8 flex flex-col gap-1 justify-center items-center bg-white bg-opacity-40">
                <div className="w-3 md:w-4 h-3 md:h-4 bg-black"></div>
                <div className="w-3 md:w-4 h-3 md:h-4 bg-white"></div>
                <div className="w-3 md:w-4 h-3 md:h-4 bg-black"></div>
                <div className="w-3 md:w-4 h-3 md:h-4 bg-white"></div>
            </div>
            <div 
              className={`absolute top-1/2 -translate-y-1/2 transition-all duration-200 ease-out flex flex-col items-center ${room.status === 'playing' ? 'animate-gallop' : ''}`}
              style={{ left: `${player.progress}%`, transform: `translate(-100%, -50%)` }}
            >
              <div className="text-4xl md:text-5xl drop-shadow-lg" style={{ filter: `drop-shadow(0 0 10px ${player.horseColor})` }}>
                🐎
              </div>
            </div>
          </div>
        ))}
        <div className="absolute left-4 top-0 bottom-0 w-1 bg-white opacity-50 z-0"></div>
      </div>

      {/* Control Area */}
      <div className={`transition-all duration-300 ${room.status === 'playing' ? 'h-1/2' : 'p-5 md:p-6 bg-white border-t-4 border-orange-200'}`}>
        {room.status === 'waiting' && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-2">
              {playersList.map(p => (
                <div key={p.uid} className="flex flex-col items-center">
                  <div className={`relative p-1 rounded-full border-4 transition-all ${p.isReady ? 'border-green-400 scale-110' : 'border-gray-200'}`}>
                    <img src={p.photoURL} className="w-10 h-10 md:w-12 md:h-12 rounded-full shadow-inner" alt="" />
                    {p.isReady && (
                        <span className="absolute -top-1 -right-1 bg-green-400 text-white rounded-full p-1 text-[8px] font-bold shadow-sm">준비됨</span>
                    )}
                    {p.uid === room.hostId && (
                        <span className="absolute -bottom-1 -right-1 bg-yellow-400 text-white rounded-full p-1 text-[8px] font-bold shadow-sm">방장</span>
                    )}
                  </div>
                  <span className="text-[10px] mt-1 text-gray-500 font-bold">{p.name}</span>
                </div>
              ))}
            </div>
            <div className="w-full max-w-sm flex gap-4">
              {isHost ? (
                <button
                  onClick={startGame}
                  disabled={!allReady}
                  className={`flex-1 py-4 md:py-5 rounded-3xl font-black text-xl md:text-2xl shadow-xl transition-all transform active:scale-95 ${allReady ? 'bg-red-500 hover:bg-red-600 text-white border-b-4 border-red-800 active:border-b-0' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  {allReady ? '경기 시작!!' : '친구 대기 중...'}
                </button>
              ) : (
                <button
                  onClick={toggleReady}
                  className={`flex-1 py-4 md:py-5 rounded-3xl font-black text-xl md:text-2xl shadow-xl transition-all transform active:scale-95 ${room.players?.[user.uid]?.isReady ? 'bg-green-500 text-white border-b-4 border-green-800 active:border-b-0' : 'bg-orange-400 text-white hover:bg-orange-500 border-b-4 border-orange-800 active:border-b-0'}`}
                >
                  {room.players?.[user.uid]?.isReady ? '준비완료!' : '준비하기!'}
                </button>
              )}
            </div>
          </div>
        )}

        {(room.status === 'starting' || localCountdown !== null) && (
          <div className="text-center py-6 md:py-8 bg-white border-t-4 border-orange-200 h-full">
            <h3 className="text-8xl md:text-9xl font-black text-red-600 animate-bounce">{localCountdown || 3}</h3>
            <p className="text-xl font-bold text-gray-400 mt-2 uppercase tracking-widest">Ready...</p>
          </div>
        )}

        {room.status === 'playing' && (
          <div 
            onMouseDown={handleTap}
            onTouchStart={handleTap}
            className={`w-full h-full flex flex-col items-center justify-center cursor-pointer transition-all border-t-8 border-orange-700 active:border-t-0 shadow-[inset_0_10px_40px_rgba(0,0,0,0.1)] ${showTapEffect ? 'bg-orange-400 translate-y-2' : 'bg-orange-500'}`}
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
          >
            <div className="text-center">
              <span className="text-white text-6xl md:text-8xl font-black italic drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
                TAB TAB!!
              </span>
              <p className="text-white/80 font-black animate-pulse text-lg md:text-2xl mt-4 uppercase tracking-[0.2em]">
                Fast as you can!
              </p>
            </div>
            {/* Visual Tap Indicator */}
            {showTapEffect && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20 text-[20vw] font-black pointer-events-none">
                HIT!
              </div>
            )}
          </div>
        )}

        {room.status === 'finished' && (
          <div className="text-center bg-yellow-50 p-4 md:p-6 rounded-3xl border-4 border-yellow-400 shadow-xl m-4 bg-white">
            <h3 className="text-2xl md:text-3xl font-black text-yellow-600 mb-2">🏆 오늘의 챔피언 🏆</h3>
            <div className="flex items-center justify-center gap-4 mb-6">
                <img src={room.players?.[room.winnerId!]?.photoURL} className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-yellow-400 shadow-lg" alt="" />
                <p className="text-3xl md:text-5xl font-bold text-gray-800">{room.players?.[room.winnerId!]?.name}</p>
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              {isHost && (
                <button
                  onClick={resetGame}
                  className="bg-red-500 hover:bg-red-600 text-white font-black px-10 py-4 rounded-2xl shadow-xl text-lg md:text-xl transition-all border-b-4 border-red-800 active:border-b-0 transform active:scale-95"
                >
                  한 판 더 달리기!
                </button>
              )}
              <button
                onClick={handleManualLeave}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-black px-10 py-4 rounded-2xl shadow-md text-lg md:text-xl transition-all border-b-4 border-gray-400 active:border-b-0 transform active:scale-95"
              >
                경기장 나가기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameRoom;