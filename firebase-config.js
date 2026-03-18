
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update, push, get } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBIGt_8Ty4Ufz9cpRfrLgbKgStb0j81Sto",
  authDomain: "iyers-c0944.firebaseapp.com",
  projectId: "iyers-c0944",
  storageBucket: "iyers-c0944.firebasestorage.app",
  messagingSenderId: "234376255779",
  appId: "1:234376255779:web:8f4b43ff3f66cfd4071496"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, onValue, update, push, get };
