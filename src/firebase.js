import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Function to calculate Handicap Differential
const calculateDifferential = (score, rating, slope) => {
  return ((score - rating) * 113) / slope;
};

// Add score to Firestore (including differential calculation)
const addScore = async ({ score, course, rating, slope }) => {
  try {
    const differential = calculateDifferential(score, rating, slope);

    const scoreData = {
      score,
      course,
      rating,
      slope,
      differential: parseFloat(differential.toFixed(2)), // Rounding to 2 decimal places
      date: new Date(),
    };

    const docRef = await addDoc(collection(db, "scores"), scoreData);
    console.log("Document written with ID: ", docRef.id);
  } catch (e) {
    console.error("Error adding document: ", e);
  }
};

export { db, addScore };