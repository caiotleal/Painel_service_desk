import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCqpfsPXllioGNZ3K5tlCeqXBUYQeaPEvw",
  authDomain: "painel-suporte-52593.firebaseapp.com",
  projectId: "painel-suporte-52593",
  storageBucket: "painel-suporte-52593.firebasestorage.app",
  messagingSenderId: "884848343137",
  appId: "1:884848343137:web:24a64f898f8d218b329220",
  measurementId: "G-E2R3181MHH"
};
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);