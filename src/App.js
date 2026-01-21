import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged,
  signOut,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { 
  User, 
  Store, 
  Trophy, 
  MessageSquare, 
  Zap, 
  ShoppingBag, 
  Send,
  Crown,
  Star,
  Gamepad2,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Firebase Configuration ---
// These are provided by your environment
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'sales-village-v1';

// --- Constants ---
const SHOP_ITEMS = [
  { id: 'coffee', name: 'Premium Roast', price: 50, icon: '☕', tier: 'Common' },
  { id: 'plant', name: 'Desk Succulent', price: 100, icon: '🪴', tier: 'Common' },
  { id: 'sneakers', name: 'Hustle Kicks', price: 600, icon: '👟', tier: 'Rare' },
  { id: 'headset', name: 'Golden Headset', price: 1000, icon: '🎧', tier: 'Rare' },
  { id: 'hawk', name: 'Mini Hawk', price: 5000, icon: '🦅', tier: 'Legendary' },
  { id: 'aura', name: 'Permanent Aura', price: 15000, icon: '✨', tier: 'Legendary' },
];

// --- Sub-Components ---

const Avatar = ({ xp, inventory }) => {
  const isTired = (xp || 0) < 50;
  const hasAura = inventory?.includes('aura');
  const hasHawk = inventory?.includes('hawk');
  
  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      {hasAura && (
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute inset-0 bg-yellow-400 rounded-full blur-2xl"
        />
      )}
      
      <div className="relative z-10 bg-indigo-100 rounded-3xl w-32 h-32 flex items-center justify-center border-4 border-indigo-200 shadow-xl text-6xl">
        {isTired ? '😴' : '😎'}
        {inventory?.includes('headset') && <span className="absolute -top-4 text-3xl">🎧</span>}
        {inventory?.includes('sneakers') && <span className="absolute -bottom-4 text-3xl">👟</span>}
      </div>

      {hasHawk && (
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="absolute -right-4 top-0 text-4xl">
          🦅
        </motion.div>
      )}

      <div className="absolute -bottom-2 flex gap-2">
        {inventory?.includes('coffee') && <span className="text-2xl">☕</span>}
        {inventory?.includes('plant') && <span className="text-2xl">🪴</span>}
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [view, setView] = useState('home');
  const [usernameInput, setUsernameInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [cooldown, setCooldown] = useState(false);

  // 1. Auth Initializer
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // If no token, we wait for the user to "login" via username hack
        }
      } catch (err) {
        console.error("Auth initialization failed", err);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Data Listeners (Strict Pathing)
  useEffect(() => {
    if (!user) return;

    // User Data Path: /artifacts/{appId}/public/data/users/{uid}
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      } else {
        // Initialize User Document
        setDoc(userRef, {
          username: user.displayName || 'New Villager',
          xp: 0,
          coins: 100,
          inventory: [],
          lastActive: serverTimestamp(),
          uid: user.uid
        });
      }
    }, (err) => console.error("User sync error:", err));

    // Chat Path: /artifacts/{appId}/public/data/messages
    const chatQuery = collection(db, 'artifacts', appId, 'public', 'data', 'messages');
    const unsubChat = onSnapshot(chatQuery, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 30));
    }, (err) => console.error("Chat sync error:", err));

    // Leaderboard Path: /artifacts/{appId}/public/data/users
    const usersQuery = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsubBoard = onSnapshot(usersQuery, (snapshot) => {
      const board = snapshot.docs.map(d => d.data());
      setLeaderboard(board.sort((a, b) => (b.xp || 0) - (a.xp || 0)));
    }, (err) => console.error("Leaderboard sync error:", err));

    return () => {
      unsubUser();
      unsubChat();
      unsubBoard();
    };
  }, [user]);

  // 3. Handlers
  const handleUsernameLogin = async (e) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    setLoading(true);
    try {
      // The "Username Hack": sign in anonymously, then set the profile name
      const cred = await signInAnonymously(auth);
      await updateProfile(cred.user, { displayName: usernameInput });
      // Refresh user state
      setUser({ ...cred.user, displayName: usernameInput });
    } catch (err) {
      console.error("Login failed", err);
    } finally {
      setLoading(false);
    }
  };

  const addXP = async (amount) => {
    if (cooldown || !user || !userData) return;
    setCooldown(true);
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    await updateDoc(userRef, {
      xp: (userData.xp || 0) + amount,
      coins: (userData.coins || 0) + Math.floor(amount / 2),
      lastActive: serverTimestamp()
    });
    setTimeout(() => setCooldown(false), 3000); // 3s Spam Guard
  };

  const buyItem = async (item) => {
    if (userData.coins < item.price || userData.inventory?.includes(item.id)) return;
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    await updateDoc(userRef, {
      coins: userData.coins - item.price,
      inventory: arrayUnion(item.id)
    });
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), {
      text: `🎊 ${userData.username} unlocked the ${item.name}!`,
      system: true,
      timestamp: Date.now()
    });
  };

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), {
      text: newMessage,
      sender: userData.username,
      senderId: user.uid,
      timestamp: Date.now()
    });
    setNewMessage('');
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading Village...</div>;

  if (!user) return (
    <div className="min-h-screen bg-indigo-950 flex items-center justify-center p-6 text-white">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white text-slate-900 p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md text-center">
        <Gamepad2 className="w-16 h-16 text-indigo-600 mx-auto mb-6" />
        <h1 className="text-3xl font-black mb-2">Sales Village</h1>
        <p className="text-slate-500 mb-8 font-medium">Claim your username to join the sanctuary.</p>
        <form onSubmit={handleUsernameLogin} className="space-y-4">
          <input 
            type="text" 
            placeholder="Username (e.g. SalesChamp)" 
            className="w-full px-6 py-4 rounded-2xl bg-slate-100 border-none ring-2 ring-transparent focus:ring-indigo-500 transition-all font-bold text-lg"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
          />
          <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">
            Join Now
          </button>
        </form>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-around md:relative md:w-24 md:flex-col md:border-r md:border-t-0 md:bg-indigo-900 md:text-white z-50">
        <NavBtn icon={<User />} active={view === 'home'} onClick={() => setView('home')} />
        <NavBtn icon={<Store />} active={view === 'shop'} onClick={() => setView('shop')} />
        <NavBtn icon={<Trophy />} active={view === 'leaderboard'} onClick={() => setView('leaderboard')} />
        <NavBtn icon={<MessageSquare />} active={view === 'chat'} onClick={() => setView('chat')} />
        <button onClick={() => signOut(auth)} className="p-4 text-red-400 md:mt-auto"><LogOut /></button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-12 mb-20 md:mb-0 max-w-5xl mx-auto w-full">
        <header className="flex justify-between items-end mb-12">
          <div>
            <span className="text-xs font-black text-indigo-500 uppercase tracking-tighter">Level {Math.floor((userData?.xp || 0) / 1000) + 1}</span>
            <h1 className="text-4xl font-black text-slate-900">{userData?.username}</h1>
          </div>
          <div className="flex gap-4">
            <StatBadge icon={<Zap className="text-yellow-500 fill-current" />} val={`${userData?.xp || 0} XP`} />
            <StatBadge icon={<ShoppingBag className="text-emerald-500 fill-current" />} val={userData?.coins || 0} />
          </div>
        </header>

        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="grid md:grid-cols-2 gap-12 items-center">
              <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-indigo-50 flex flex-col items-center">
                <Avatar xp={userData?.xp} inventory={userData?.inventory} />
                <p className="mt-8 text-xl font-bold text-slate-400">{(userData?.xp || 0) < 50 ? 'Resting...' : 'Fully Charged ⚡'}</p>
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-black mb-4">Daily Grind</h3>
                <ActionCard title="Dial 10 Prospects" xp={50} onClick={() => addXP(50)} disabled={cooldown} />
                <ActionCard title="Sync CRM" xp={100} onClick={() => addXP(100)} disabled={cooldown} />
                <ActionCard title="Close Deal" xp={1000} onClick={() => addXP(1000)} disabled={cooldown} />
                {cooldown && <p className="text-indigo-400 text-center font-bold animate-pulse">Focus Cooldown Active...</p>}
              </div>
            </motion.div>
          )}

          {view === 'shop' && (
            <motion.div key="shop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {SHOP_ITEMS.map(item => {
                const owned = userData?.inventory?.includes(item.id);
                return (
                  <div key={item.id} className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-5xl">{item.icon}</span>
                      <div>
                        <p className="text-xs font-black text-indigo-500">{item.tier}</p>
                        <h4 className="text-xl font-black">{item.name}</h4>
                      </div>
                    </div>
                    <button 
                      onClick={() => buyItem(item)}
                      disabled={owned || userData?.coins < item.price}
                      className={`px-6 py-3 rounded-xl font-black transition-all ${owned ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                    >
                      {owned ? 'OWNED' : `${item.price}💰`}
                    </button>
                  </div>
                );
              })}
            </motion.div>
          )}

          {view === 'leaderboard' && (
            <motion.div key="board" className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
              <div className="p-8 border-b font-black text-2xl bg-slate-50">Village Rankings</div>
              {leaderboard.map((p, i) => (
                <div key={p.uid} className={`flex items-center p-6 border-b last:border-0 ${p.uid === user.uid ? 'bg-indigo-50' : ''}`}>
                  <span className="w-8 font-black text-slate-300">{i + 1}</span>
                  <div className="flex-1 font-bold text-lg">{p.username} {p.uid === user.uid && "⭐"}</div>
                  <div className="font-black text-indigo-600">{p.xp} XP</div>
                </div>
              ))}
            </motion.div>
          )}

          {view === 'chat' && (
            <motion.div key="chat" className="h-[65vh] flex flex-col bg-white rounded-[2.5rem] shadow-xl border overflow-hidden">
              <div className="flex-1 p-6 overflow-y-auto space-y-4 flex flex-col-reverse">
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.system ? 'justify-center' : m.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                    {m.system ? (
                      <div className="bg-indigo-100 text-indigo-600 px-4 py-1 rounded-full text-xs font-black uppercase">{m.text}</div>
                    ) : (
                      <div className={`px-5 py-3 rounded-2xl max-w-[80%] ${m.senderId === user.uid ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                        <p className="text-[10px] font-black opacity-50 uppercase mb-1">{m.sender}</p>
                        <p className="font-medium">{m.text}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <form onSubmit={sendChatMessage} className="p-4 bg-slate-50 border-t flex gap-2">
                <input 
                  type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                  placeholder="Chat with the Village..." className="flex-1 px-6 py-3 rounded-full border-none focus:ring-2 focus:ring-indigo-500"
                />
                <button className="bg-indigo-600 text-white p-3 rounded-full"><Send size={20} /></button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

const NavBtn = ({ icon, active, onClick }) => (
  <button onClick={onClick} className={`p-4 rounded-2xl transition-all ${active ? 'bg-indigo-100 text-indigo-600 md:bg-white md:text-indigo-900 shadow-md' : 'text-slate-400 md:text-indigo-300'}`}>
    {React.cloneElement(icon, { size: 28 })}
  </button>
);

const StatBadge = ({ icon, val }) => (
  <div className="bg-white px-5 py-3 rounded-2xl border shadow-sm flex items-center gap-2">
    {icon} <span className="font-black text-lg">{val}</span>
  </div>
);

const ActionCard = ({ title, xp, onClick, disabled }) => (
  <button 
    onClick={onClick} disabled={disabled}
    className={`w-full p-6 rounded-3xl border-2 border-slate-100 bg-white text-left flex justify-between items-center transition-all ${disabled ? 'opacity-50 grayscale' : 'hover:border-indigo-500 hover:shadow-lg active:scale-95'}`}
  >
    <span className="font-black text-xl">{title}</span>
    <span className="bg-indigo-50 text-indigo-600 px-4 py-1 rounded-full font-black">+{xp} XP</span>
  </button>
);
