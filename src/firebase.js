import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, orderBy, query, where, limit } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';

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

// Firebase authentication functions
const signUp = async (email, password, firstName, lastName) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Store user details (firstName, lastName) in Firestore
    await addDoc(collection(db, "users"), {
      userId: user.uid,
      email: user.email,
      firstName,
      lastName
    });

    console.log("User signed up:", user);
    return { ...user, firstName, lastName };
  } catch (error) {
    console.error("Error signing up: ", error.message);
  }
};

const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Fetch user details from Firestore
    const userDoc = await getDocs(query(collection(db, "users"), where("userId", "==", user.uid)));
    const userData = userDoc.docs[0]?.data();
    return { ...user, firstName: userData?.firstName, lastName: userData?.lastName };
  } catch (error) {
    console.error("Error signing in: ", error.message);
  }
};

const logOut = () => {
  signOut(auth)
    .then(() => {
      console.log("User logged out");
    })
    .catch((error) => {
      console.error("Error logging out: ", error);
    });
};

// Fetch the latest 20 scores for a specific user
const getScoresForUser = async (userEmail) => {
  try {
    const scoresQuery = query(
      collection(db, "scores"),
      where("user", "==", userEmail),  // Filter by user email
      orderBy("date", "desc"),         // Order by date (newest first)
      limit(20)                        // Limit to the latest 20 scores
    );

    const querySnapshot = await getDocs(scoresQuery);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error fetching scores for user: ", error);
  }
};

// Fetch courses from Firestore
const getCourses = async () => {
  const querySnapshot = await getDocs(collection(db, "courses"));
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

// Fetch scores from Firestore, ordered by date (newest first)
const getScores = async () => {
  const scoresQuery = query(collection(db, "scores"), orderBy("date", "desc"), limit(20));
  const querySnapshot = await getDocs(scoresQuery);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

// Function to calculate Handicap Differential
const calculateDifferential = (score, rating, slope) => {
  const differential = ((score - rating) * 113) / slope;
  return parseFloat((differential * 0.96).toFixed(2)); // Apply 0.96 multiplier and round to 2 decimal places
};

// Function to add a score to Firestore
const addScore = async ({ score, course, rating, slope, user }) => {
  try {
    // Fetch user details (first name and last name) from Firestore
    const userDoc = await getDocs(query(collection(db, "users"), where("email", "==", user)));
    const userData = userDoc.docs[0]?.data();
    const firstName = userData?.firstName || 'Unknown';
    const lastName = userData?.lastName || 'Unknown';

    const differential = calculateDifferential(score, rating, slope);
    const scoreData = {
      score,
      course,
      rating,
      slope,
      differential: parseFloat(differential.toFixed(2)),
      user,  // Storing the user's email
      firstName,  // Store first name
      lastName,  // Store last name
      date: new Date(),
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
export { db, auth, signUp, signIn, logOut, getCourses, getScores, getScoresForUser, addScore, addCourse };