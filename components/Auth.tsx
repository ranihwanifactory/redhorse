
import React, { useState } from 'react';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-500 to-orange-400 flex flex-col items-center justify-center p-6 text-white">
      <div className="bg-white text-gray-800 p-8 rounded-3xl shadow-2xl w-full max-w-md border-8 border-orange-200">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-red-600 mb-2">🐎 2026 병오년</h1>
          <h2 className="text-2xl font-bold text-orange-500">대박 말달리기</h2>
          <p className="text-sm text-gray-500 mt-2">친구들과 함께 신나게 달려보아요!</p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold mb-1">이름</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-xl bg-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold mb-1">이메일</label>
            <input
              type="email"
              className="w-full px-4 py-3 rounded-xl bg-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">비밀번호</label>
            <input
              type="password"
              className="w-full px-4 py-3 rounded-xl bg-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-500 text-xs italic">{error}</p>}
          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
          >
            {isLogin ? '로그인하고 달리기' : '회원가입하기'}
          </button>
        </form>

        <div className="my-6 flex items-center">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="mx-4 text-gray-400 text-sm">OR</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="google" />
          구글로 시작하기
        </button>

        <p className="text-center mt-6 text-sm">
          {isLogin ? '처음이신가요?' : '이미 계정이 있나요?'}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="ml-2 text-orange-600 font-bold underline"
          >
            {isLogin ? '회원가입' : '로그인'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
