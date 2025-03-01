import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence } from 'firebase/auth';

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
const auth = getAuth(app);

// Set persistence to session
setPersistence(auth, browserSessionPersistence);

const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw new Error(error.message);
  }
};

const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error(error.message);
  }
};

// Fetch the predefined player list from Firestore
const getPlayers = async () => {
  const querySnapshot = await getDocs(collection(db, "players"));
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name
  }));
};

// Fetch courses from Firestore
const getCourses = async () => {
  const querySnapshot = await getDocs(collection(db, "courses"));
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

// Fetch all scores from Firestore, ordered by date (newest first)
const getScores = async () => {
  const scoresQuery = query(collection(db, "scores"), orderBy("date", "desc"));
  const querySnapshot = await getDocs(scoresQuery);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

// Function to calculate Handicap Differential
const calculateDifferential = (score, rating, slope, holeType, handicapIndex) => {
  let differential;

  if (holeType === '18') {
    // Standard calculation for 18-hole scores
    differential = ((score - rating) * 113) / slope;
  } else {
    // Calculate 9-hole score differential
    const scoreDifferential = ((score - rating) * 113) / slope;
    // Calculate estimated score differential
    const estimatedDifferential = (handicapIndex * 0.52) + 1.197;
    // Combine both differentials
    differential = scoreDifferential + estimatedDifferential;
  }

  // Apply the 0.96 multiplier to all differentials
  return parseFloat((differential * 0.96).toFixed(2));
};

// Function to add a score to Firestore
const addScore = async ({ score, course, rating, slope, player, holeType, handicapIndex }) => {
  try {
    const differential = calculateDifferential(score, rating, slope, holeType, handicapIndex);
    const scoreData = {
      score,
      course,
      rating,
      slope,
      differential: parseFloat(differential.toFixed(2)),
      player,  // Store player name instead of user
      date: new Date(),
      holeType: holeType,  // Add holeType here
      handicapIndex: holeType === '9' ? parseFloat(handicapIndex) : null // Add handicapIndex if 9-hole
    };

    await addDoc(collection(db, "scores"), scoreData);
    console.log("Score added successfully!");
  } catch (e) {
    console.error("Error adding score: ", e);
  }
};

// Function to add a new course to Firestore
const addCourse = async ({ course, rating, slope }) => {
  try {
    await addDoc(collection(db, "courses"), { 
      course, 
      rating: parseFloat(rating) || 0, 
      slope: parseFloat(slope) || 0 
    });
    console.log("Course added successfully!");
  } catch (e) {
    console.error("Error adding course: ", e);
  }
};

// Export all functions
export { db, getPlayers, getCourses, getScores, addScore, addCourse, signIn, signOutUser };