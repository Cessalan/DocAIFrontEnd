// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {getAuth} from "firebase/auth";
import { getStorage } from "firebase/storage";
import { ref } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA1zh3gDXoSAvxuqvuG81HgRSu_Qnbtr4k",
  authDomain: "docai-efb03.firebaseapp.com",
  projectId: "docai-efb03",
  storageBucket: "docai-efb03.firebasestorage.app",
  messagingSenderId: "1075876064685",
  appId: "1:1075876064685:web:de7c9e3a9db184b78b4524",
  measurementId: "G-JGD87V657Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const user = auth.currentUser;
const db = getFirestore(app);

const analytics = getAnalytics(app);


// Initialize Firebase Storage and export
const storage = getStorage(app);

// Helper function to create storage references with common patterns
const createStorageRef = (path) => {
  return ref(storage, path);
};

const uploadsRef = ref(storage, 'uploads');

export{app,auth,storage,user,db,createStorageRef}