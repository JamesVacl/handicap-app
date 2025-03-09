import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, orderBy, query, updateDoc, doc } from 'firebase/firestore';
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

// Add this function after getScores
const getPlayerHandicaps = async () => {
  const scores = await getScores();
  const playerScores = {};

  // Group scores by player
  scores.forEach(score => {
    if (!playerScores[score.player]) {
      playerScores[score.player] = [];
    }
    playerScores[score.player].push({
      differential: score.differential,
      date: score.date
    });
  });

  // Calculate handicap for each player
  const playerHandicaps = Object.entries(playerScores).map(([playerName, scores]) => {
    // Sort differentials by date (newest first)
    const sortedScores = scores.sort((a, b) => b.date - a.date);
    
    // Take the most recent 20 scores
    const recentScores = sortedScores.slice(0, 20);
    
    // Sort differentials numerically for handicap calculation
    const sortedDifferentials = recentScores
      .map(score => score.differential)
      .sort((a, b) => a - b);

    // Calculate handicap based on number of scores
    let handicap = 0;
    if (sortedDifferentials.length > 0) {
      const numScores = sortedDifferentials.length;
      const scoresToUse = Math.min(8, Math.floor(numScores * 0.4));
      if (scoresToUse > 0) {
        const sum = sortedDifferentials.slice(0, scoresToUse).reduce((a, b) => a + b, 0);
        handicap = parseFloat((sum / scoresToUse).toFixed(1));
      }
    }

    return {
      name: playerName,
      handicap: handicap
    };
  });

  return playerHandicaps;
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
const addScore = async ({ score, course, rating, slope, player, holeType, handicapIndex, date }) => {
  try {
    const differential = calculateDifferential(score, rating, slope, holeType, handicapIndex);
    const scoreData = {
      score,
      course,
      rating,
      slope,
      differential: parseFloat(differential.toFixed(2)),
      player,
      date: date ? new Date(date) : new Date(), // Use provided date or current date as fallback
      holeType: holeType,
      handicapIndex: holeType === '9' ? parseFloat(handicapIndex) : null
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

// Fetch teams from Firestore
const getTeams = async () => {
  const teamsRef = collection(db, 'Teams');
  const snapshot = await getDocs(teamsRef);
  const teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Get current handicaps
  const playerHandicaps = await getPlayerHandicaps();
  
  // Update team players with current handicaps
  return teams.map(team => {
    const updatedPlayers = team.players?.map(player => {
      const currentHandicap = playerHandicaps.find(p => p.name === player.name);
      return {
        ...player,
        handicap: currentHandicap?.handicap || player.handicap
      };
    }) || [];
    
    // Recalculate team average
    const averageHandicap = updatedPlayers.length 
      ? parseFloat((updatedPlayers.reduce((acc, p) => acc + p.handicap, 0) / updatedPlayers.length).toFixed(1))
      : 0;

    return {
      ...team,
      players: updatedPlayers,
      averageHandicap
    };
  });
};

// Add a new team to Firestore
const addTeam = async (teamData) => {
  const teamsRef = collection(db, 'Teams');
  return await addDoc(teamsRef, teamData);
};

// Update an existing team in Firestore
const updateTeam = async (teamId, teamData) => {
  const teamRef = doc(db, 'Teams', teamId);
  return await updateDoc(teamRef, teamData);
};

// Export all functions
export { 
  db, 
  getPlayers, 
  getCourses, 
  getScores, 
  addScore, 
  addCourse, 
  signIn, 
  signOutUser, 
  getTeams, 
  addTeam, 
  updateTeam,
  getPlayerHandicaps 
};