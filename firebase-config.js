
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    onSnapshot, 
    updateDoc, 
    collection, 
    getDocs, 
    getDoc,
    query
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBIGt_8Ty4Ufz9cpRfrLgbKgStb0j81Sto",
  authDomain: "iyers-c0944.firebaseapp.com",
  projectId: "iyers-c0944",
  storageBucket: "iyers-c0944.firebasestorage.app",
  messagingSenderId: "234376255779",
  appId: "1:234376255779:web:8f4b43ff3f66cfd4071496"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { 
    db, 
    doc, 
    setDoc, 
    onSnapshot, 
    updateDoc, 
    collection, 
    getDocs, 
    getDoc,
    query
};
