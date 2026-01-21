import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCk-uyQzpV6s6G64uEf6okpKgM8V8ZpzN4",
  authDomain: "productivity-tracker-482df.firebaseapp.com",
  projectId: "productivity-tracker-482df",
  storageBucket: "productivity-tracker-482df.firebasestorage.app",
  messagingSenderId: "999818232595",
  appId: "1:999818232595:web:48ab173a0bdaf8bc5b90e6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
