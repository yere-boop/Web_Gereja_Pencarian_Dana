import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// TODO: Ganti dengan konfigurasi dari Firebase Console Anda
const firebaseConfig = {
  apiKey: "AIzaSyCjnybk7UYmRDWn7sFenz8NPdypQavb0_8",
  authDomain: "kasir-gereja.firebaseapp.com",
  projectId: "kasir-gereja",
  storageBucket: "kasir-gereja.firebasestorage.app",
  messagingSenderId: "575959470048",
  appId: "1:575959470048:web:7079906b60cd1cba342585",
  measurementId: "G-6BLBF8G2XZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
