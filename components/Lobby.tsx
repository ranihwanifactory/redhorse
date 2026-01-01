
import React, { useState, useEffect } from 'react';
import { User, signOut } from 'firebase/auth';
import { ref, push, onValue, set } from 'firebase/database';
import { auth, db } from '../firebase';
import { Room } from '../types';

interface LobbyProps {
  user: User;
  isMuted?: boolean;
}

const horseColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
const CLICK_SFX = "https://cdn.pixabay.com/audio/2022/03/15/audio_73060c1d63.mp3";

const Lobby: React.FC<LobbyProps> = ({ user, isMuted = false }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [roomName, setRoomName] = useState('');

  useEffect(() => {
    const roomsRef = ref(db, 'rooms');
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const roomList: Room[] = Object.entries(data)
          .map(([id, room]: [string, any]) => ({
            id,
            ...room
          }))
          .filter(r => r.status === 'waiting' && r.name && r.players);
        setRooms(roomList);
      } else {
        setRooms([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const playClick = () => {
    if (isMuted) return;
    new Audio(CLICK_SFX).play().catch(() => {});
  };

  const createRoom = async () => {
    if (!roomName.trim()) return;
    playClick();
    setIsCreating(true);
    const roomsRef = ref(db, 'rooms');
    const newRoomRef = push(roomsRef);
    const roomId = newRoomRef.key;

    if (roomId) {
      const initialRoom: any = {
        name: roomName,
        hostId: user.uid,
        status: 'waiting',
        createdAt: Date.now(),
        players: {
          [user.uid]: {
            uid: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'Player',
            photoURL: user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`,
            progress: 0,
            isReady: false,
            score: 0,
            horseColor: horseColors[Math.floor(Math.random() * horseColors.length)]
          }
        }
      };

      await set(newRoomRef, initialRoom);
      window.location.hash = `#/room/${roomId}`;
    }
    setIsCreating(false);
  };

  const joinRoom = (roomId: string) => {
    playClick();
    window.location.hash = `#/room/${roomId}`;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6 bg-white p-3 md:p-4 rounded-2xl shadow-md border-b-4 border-orange-200">
        <div className="flex items-center gap-3">
          <img src={user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`} className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-orange-400" alt="avatar" />
          <div className="hidden sm:block">
            <p className="font-bold text-sm md:text-lg text-gray-800 leading-tight">{user.displayName || user.email}</p>
            <p className="text-xs text-gray-500">2026 Red Horse Rider 🏇</p>
          </div>
        </div>
        <button
          onClick={() => { playClick(); signOut(auth); }}
          className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-xl font-bold text-xs md:text-sm transition-colors"
        >
          로그아웃
        </button>
      </div>

      <div className="bg-red-500 rounded-3xl p-6 md:p-8 shadow-xl text-white mb-8 border-b-8 border-red-700">
        <h2 className="text-2xl md:text-3xl font-bold mb-4 flex items-center gap-2">
          <span>🏟️</span> 새로운 경기장 만들기
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="경기장 이름을 입력하세요"
            className="w-full sm:flex-1 px-5 py-4 rounded-2xl text-gray-800 focus:outline-none text-base md:text-lg shadow-inner"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && createRoom()}
          />
          <button
            onClick={createRoom}
            disabled={isCreating}
            className="w-full sm:w-auto bg-yellow-400 hover:bg-yellow-300 text-red-700 font-black px-8 py-4 rounded-2xl shadow-lg transform active:scale-95 transition-all text-lg md:text-xl border-b-4 border-yellow-600 active:border-b-0"
          >
            {isCreating ? '생성 중...' : '방 만들기!'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-xl md:text-2xl font-bold text-gray-800">진행 중인 대기방</h3>
          <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs md:text-sm font-bold">{rooms.length}개</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rooms.length > 0 ? (
          rooms.map((room) => (
            <div key={room.id} className="bg-white p-5 rounded-3xl shadow-lg border-2 border-gray-50 hover:border-orange-400 transition-all cursor-pointer group flex justify-between items-center" onClick={() => joinRoom(room.id)}>
              <div className="flex-1">
                <h4 className="text-lg md:text-xl font-bold text-gray-800 mb-1 group-hover:text-orange-500 transition-colors truncate pr-2">{room.name}</h4>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {Object.values(room.players).slice(0, 3).map((p: any) => (
                      <img key={p.uid} src={p.photoURL} className="w-6 h-6 rounded-full border-2 border-white" alt="" />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 font-medium">참여자: {Object.keys(room.players || {}).length}명 / 4명</p>
                </div>
              </div>
              <div className="bg-orange-100 text-orange-600 px-4 py-2 rounded-xl font-bold group-hover:bg-orange-500 group-hover:text-white transition-all text-sm whitespace-nowrap shadow-sm">
                입장하기
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-16 bg-white rounded-3xl border-4 border-dashed border-gray-100">
            <div className="text-6xl mb-4 animate-bounce">🐎</div>
            <p className="text-gray-400 text-lg font-bold">아직 열린 경기장이 없어요.<br/><span className="text-orange-400">첫 번째 방을 만들어보세요!</span></p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;
