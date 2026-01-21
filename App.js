import React, { useState, useEffect } from 'react';
import { auth, db } from './firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import ManagerView from './ManagerView';
import RepView from './RepView';

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const docRef = doc(db, "users", u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRole(docSnap.data().role);
          setUser(u);
        }
      } else {
        setUser(null);
        setRole(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async () => {
    const dummyEmail = `${username}@salesapp.com`;
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, dummyEmail, password);
      } else {
        const res = await createUserWithEmailAndPassword(auth, dummyEmail, password);
        await setDoc(doc(db, "users", res.user.uid), {
          username: username,
          role: isManager ? "manager" : "rep",
          xp: 0,
          coins: 0,
          teamId: "team_alpha" // Default for V1
        });
      }
    } catch (err) { alert(err.message); }
  };

  if (!user) {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <h1>{isLogin ? "Welcome Back" : "Join the Village"}</h1>
        <input placeholder="Username" onChange={(e) => setUsername(e.target.value)} /><br/>
        <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} /><br/>
        {!isLogin && (
          <label><input type="checkbox" onChange={(e) => setIsManager(e.target.checked)} /> Join as Manager</label>
        )}
        <br/><button onClick={handleAuth}>{isLogin ? "Login" : "Sign Up"}</button>
        <p onClick={() => setIsLogin(!isLogin)} style={{cursor:'pointer'}}>{isLogin ? "Need an account? Sign up" : "Have an account? Log in"}</p>
      </div>
    );
  }

  return (
    <div>
      <nav style={{display:'flex', justifyContent:'space-between', padding:'10px', background:'#eee'}}>
        <span>Hello, {username}! Role: {role}</span>
        <button onClick={() => signOut(auth)}>Logout</button>
      </nav>
      {role === "manager" ? <ManagerView /> : <RepView userId={user.uid} />}
    </div>
  );
}

export default App;
