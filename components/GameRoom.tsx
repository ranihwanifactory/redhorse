
import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { ref, onValue, set, remove, onDisconnect, update } from 'firebase/database';
import { db } from '../firebase';
import { Room, Player, GameStatus } from '../types';

interface GameRoomProps {
  user: User;
  roomId: string;
  onLeave: () => void;
}

const horseColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

const GameRoom: React.FC<GameRoomProps> = ({ user, roomId, onLeave }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showTapEffect, setShowTapEffect] = useState(false);
  
  const roomRef = ref(db, `rooms/${roomId}`);

  useEffect(() => {
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        onLeave();
        return;
      }
      setRoom({ id: roomId, ...data });
    });

    // Handle host disconnect logic
    const hostCheckRef = ref(db, `rooms/${roomId}`);
    onValue(hostCheckRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.hostId === user.uid) {
            onDisconnect(hostCheckRef).remove();
        }
    }, { onlyOnce: true });

    return () => {
      unsubscribe();
    };
  }, [roomId, user.uid, onLeave]);

  // Handle joining if not in players list
  useEffect(() => {
    if (room && !room.players[user.uid] && Object.keys(room.players).length < 4 && room.status === 'waiting') {
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
  }, [room, roomId, user]);

  // Countdown logic for host
  useEffect(() => {
    if (room?.status === 'starting') {
      let count = 3;
      setCountdown(count);
      const timer = setInterval(() => {
        count -= 1;
        if (count <= 0) {
          clearInterval(timer);
          if (room.hostId === user.uid) {
            update(roomRef, { status: 'playing' });
          }
          setCountdown(null);
        } else {
          setCountdown(count);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [room?.status, room?.hostId, user.uid, roomRef]);

  const toggleReady = () => {
    if (!room) return;
    const playerRef = ref(db, `rooms/${roomId}/players/${user.uid}/isReady`);
    set(playerRef, !room.players[user.uid].isReady);
  };

  const startGame = () => {
    if (!room) return;
    update(roomRef, { status: 'starting' });
  };

  const handleTap = () => {
    if (!room || room.status !== 'playing' || room.winnerId) return;

    const currentPlayer = room.players[user.uid];
    // Reduced from 1.5 to 0.7 to make the race longer (~143 taps to finish)
    const newProgress = Math.min(currentPlayer.progress + 0.7, 100);

    const updates: any = {};
    updates[`players/${user.uid}/progress`] = newProgress;

    if (newProgress >= 100 && !room.winnerId) {
      updates['status'] = 'finished';
      updates['winnerId'] = user.uid;
    }

    update(roomRef, updates);
    
    setShowTapEffect(true);
    setTimeout(() => setShowTapEffect(false), 50);
  };

  const resetGame = () => {
    if (!room) return;
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
    const shareData = {
      title: '2026 병오년 말달리기',
      text: `${user.displayName}님이 경기장에 초대했습니다! 함께 달려보아요!`,
      url: `${window.location.origin}${window.location.pathname}#/room/${roomId}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        alert('링크가 복사되었습니다!');
      }
    } catch (err) {
      console.error('Share failed', err);
    }
  };

  const handleManualLeave = async () => {
    if (room && room.hostId === user.uid) {
      if (confirm('방장이 나가면 방이 사라집니다. 정말 나가시겠습니까?')) {
        await remove(roomRef);
        onLeave();
      }
    } else {
      // Non-host just leaves
      if (room) {
          const playerRef = ref(db, `rooms/${roomId}/players/${user.uid}`);
          await remove(playerRef);
      }
      onLeave();
    }
  };

  if (!room) return null;

  const players = Object.values(room.players) as Player[];
  const isHost = room.hostId === user.uid;
  const allReady = players.length > 1 && players.every(p => p.isReady || p.uid === room.hostId);

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-orange-50">
      {/* Header */}
      <div className="p-4 bg-white shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <button onClick={handleManualLeave} className="p-2 hover:bg-gray-100 rounded-full">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <h2 className="font-bold text-lg text-gray-800">{room.name}</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={shareRoom} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
            방 공유
          </button>
          {isHost && (
            <button onClick={() => remove(roomRef)} className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-bold">방 삭제</button>
          )}
        </div>
      </div>

      {/* Track Area */}
      <div className="flex-1 relative bg-cover bg-center overflow-hidden flex flex-col justify-center gap-8 px-4" style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/grass.png')`, backgroundColor: '#34d399' }}>
        {players.map((player) => (
          <div key={player.uid} className="relative h-16 w-full bg-white bg-opacity-20 rounded-full border-2 border-white border-dashed">
            <div className="absolute -top-6 left-0 flex items-center gap-2">
                <img src={player.photoURL} className="w-5 h-5 rounded-full border border-white" alt="" />
                <span className="text-white text-xs font-bold bg-black bg-opacity-30 px-2 rounded-full">{player.name}</span>
            </div>

            <div className="absolute right-0 top-0 bottom-0 w-8 flex flex-col gap-1 justify-center items-center bg-white bg-opacity-40">
                <div className="w-4 h-4 bg-black"></div>
                <div className="w-4 h-4 bg-white"></div>
                <div className="w-4 h-4 bg-black"></div>
                <div className="w-4 h-4 bg-white"></div>
            </div>

            <div 
              className={`absolute top-1/2 -translate-y-1/2 transition-all duration-150 ease-out flex flex-col items-center ${room.status === 'playing' ? 'animate-gallop' : ''}`}
              style={{ left: `${player.progress}%`, transform: `translate(-100%, -50%)` }}
            >
              <div className="text-5xl drop-shadow-lg filter" style={{ filter: `drop-shadow(0 0 10px ${player.horseColor})` }}>
                🐎
              </div>
            </div>
          </div>
        ))}
        <div className="absolute left-4 top-0 bottom-0 w-1 bg-white opacity-50 z-0"></div>
      </div>

      {/* Control Area */}
      <div className="p-6 bg-white border-t-4 border-orange-200">
        {room.status === 'waiting' && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-4 mb-4">
              {players.map(p => (
                <div key={p.uid} className="flex flex-col items-center">
                  <div className={`relative p-1 rounded-full border-4 ${p.isReady ? 'border-green-400' : 'border-gray-200'}`}>
                    <img src={p.photoURL} className="w-12 h-12 rounded-full" alt="" />
                    {p.isReady && (
                        <span className="absolute -top-1 -right-1 bg-green-400 text-white rounded-full p-1 text-[8px] font-bold">READY</span>
                    )}
                    {p.uid === room.hostId && (
                        <span className="absolute -bottom-1 -right-1 bg-yellow-400 text-white rounded-full p-1 text-[8px] font-bold">HOST</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="w-full max-w-sm flex gap-4">
              {isHost ? (
                <button
                  onClick={startGame}
                  disabled={!allReady}
                  className={`flex-1 py-4 rounded-3xl font-black text-2xl shadow-xl transition-all ${allReady ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  {allReady ? '시작하기!!' : '친구들을 기다려요'}
                </button>
              ) : (
                <button
                  onClick={toggleReady}
                  className={`flex-1 py-4 rounded-3xl font-black text-2xl shadow-xl transition-all ${room.players[user.uid]?.isReady ? 'bg-green-500 text-white' : 'bg-orange-400 text-white hover:bg-orange-500'}`}
                >
                  {room.players[user.uid]?.isReady ? '준비완료!' : '준비하기!'}
                </button>
              )}
            </div>
          </div>
        )}

        {room.status === 'starting' && (
          <div className="text-center py-8">
            <h3 className="text-8xl font-black text-red-600 animate-ping">{countdown}</h3>
          </div>
        )}

        {room.status === 'playing' && (
          <div className="flex flex-col items-center gap-6">
            <button
              onMouseDown={handleTap}
              onTouchStart={(e) => { e.preventDefault(); handleTap(); }}
              className={`w-40 h-40 rounded-full border-b-8 border-orange-600 bg-orange-400 text-white text-4xl font-black flex items-center justify-center transition-all transform active:translate-y-2 active:border-b-0 shadow-2xl ${showTapEffect ? 'scale-95' : 'scale-100'}`}
            >
              TAP!!
            </button>
            <p className="text-orange-600 font-bold animate-pulse text-lg uppercase">연타 하세요!!!</p>
          </div>
        )}

        {room.status === 'finished' && (
          <div className="text-center bg-yellow-50 p-6 rounded-3xl border-4 border-yellow-400">
            <h3 className="text-3xl font-black text-yellow-600 mb-2">🎉 우승자 탄생! 🎉</h3>
            <div className="flex items-center justify-center gap-4 mb-6">
                <img src={room.players[room.winnerId!]?.photoURL} className="w-16 h-16 rounded-full border-4 border-yellow-400 shadow-lg" alt="" />
                <p className="text-4xl font-bold text-gray-800">{room.players[room.winnerId!]?.name}</p>
            </div>
            {isHost && (
              <button
                onClick={resetGame}
                className="bg-red-500 hover:bg-red-600 text-white font-black px-10 py-4 rounded-2xl shadow-xl text-xl transition-all"
              >
                다시 한 판 더!
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameRoom;
