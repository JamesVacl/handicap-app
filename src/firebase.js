import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, orderBy, query, updateDoc, doc, where } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only once
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Initialize Analytics only on client side
let analytics = null;

// Use typeof window check instead of process.browser
if (typeof window !== 'undefined') {
  // Check if analytics is supported before initializing
  isSupported().then(yes => {
    if (yes) {
      analytics = getAnalytics(app);
    }
  });
  
  // Set persistence to session
  setPersistence(auth, browserSessionPersistence).catch(console.error);
}

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
    // Only include 18-hole scores and combined 9-hole scores that have valid differentials
    if (score.differential !== null && (score.holeType === '18' || score.isComposed)) {
      playerScores[score.player].push({
        id: score.id,
        differential: score.differential,
        date: score.date,
        isUsedForDifferential: false // Initialize flag
      });
    }
  });

  // Calculate handicap for each player
  const playerHandicaps = Object.entries(playerScores).map(([playerName, scores]) => {
    // Sort differentials by date (newest first)
    const sortedScores = scores.sort((a, b) => b.date - a.date);
    
    // Take the most recent 20 scores
    const recentScores = sortedScores.slice(0, 20);
    
    // Create array with index to preserve position
    const differentialsWithIndex = recentScores.map((score, index) => ({
      ...score,
      originalIndex: index
    })).sort((a, b) => {
      if (a.differential !== b.differential) {
        return a.differential - b.differential;
      }
      // If differentials are equal, use more recent score
      return b.date - a.date;
    });

    // Take lowest 8 differentials and mark them
    const lowestEight = differentialsWithIndex.slice(0, 8);
    lowestEight.forEach(score => {
      const originalScore = recentScores[score.originalIndex];
      originalScore.isUsedForDifferential = true;
    });

    // Calculate handicap
    const handicap = lowestEight.length > 0
      ? parseFloat((lowestEight.reduce((sum, score) => sum + score.differential, 0) / lowestEight.length).toFixed(1))
      : 0;

    return {
      name: playerName,
      handicap: handicap,
      scores: recentScores // Include the marked scores
    };
  });

  // Update the isUsedForDifferential flag in Firestore
  await Promise.all(
    playerHandicaps.flatMap(player =>
      player.scores
        .filter(score => score.id) // Only process scores with IDs
        .map(score =>
          updateDoc(doc(db, "scores", score.id), {
            isUsedForDifferential: score.isUsedForDifferential
          })
        )
    )
  );

  return playerHandicaps;
};

// Function to calculate Handicap Differential
const calculateDifferential = (score, rating, slope, holeType, isComposed = false) => {
  let differential;

  if (holeType === '18' || isComposed) {
    // Standard calculation for 18-hole scores and combined 9-hole scores
    differential = ((score - rating) * 113) / slope;
  } else {
    // For single 9-hole scores, don't calculate differential yet
    return null;
  }

  // Apply the 0.96 multiplier to all differentials
  return parseFloat((differential * 0.96).toFixed(2));
};

// Function to add a score to Firestore
const addScore = async ({ score, course, rating, slope, player, holeType, date }) => {
  try {
    if (holeType === '9') {
      // Add 9-hole score with needsPairing flag
      const scoreData = {
        score,
        course,
        rating,
        slope,
        differential: null,
        player,
        date: date ? new Date(date) : new Date(),
        holeType,
        needsPairing: true
      };
      
      await addDoc(collection(db, "scores"), scoreData);
      
      // Try to pair with another unpaired 9-hole score
      await tryToPairNineHoleScores(player);
    } else {
      // Handle 18-hole score normally
      const differential = calculateDifferential(score, rating, slope, holeType);
      const scoreData = {
        score,
        course,
        rating,
        slope,
        differential,
        player,
        date: date ? new Date(date) : new Date(),
        holeType
      };
      
      await addDoc(collection(db, "scores"), scoreData);
    }

    console.log("Score added successfully!");
  } catch (e) {
    console.error("Error adding score: ", e);
  }
};

// Add new function to pair 9-hole scores
const tryToPairNineHoleScores = async (player) => {
  try {
    // Get all unpaired 9-hole scores for this player
    const scoresQuery = query(
      collection(db, "scores"),
      where("player", "==", player),
      where("holeType", "==", "9"),
      where("needsPairing", "==", true),
      orderBy("date", "asc")  // Keep the oldest scores first
    );
    
    const querySnapshot = await getDocs(scoresQuery);
    const unpaired = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // If we have at least 2 unpaired 9-hole scores
    if (unpaired.length >= 2) {
      const score1 = unpaired[0];
      const score2 = unpaired[1];
      
      // Calculate combined values
      const totalScore = score1.score + score2.score;
      const totalRating = score1.rating + score2.rating;
      const avgSlope = Math.round((score1.slope + score2.slope) / 2);
      
      // Calculate differential for combined score
      const differential = calculateDifferential(
        totalScore, 
        totalRating, 
        avgSlope, 
        '18', 
        true
      );

      // Create combined score entry
      await addDoc(collection(db, "scores"), {
        score: totalScore,
        course: `${score1.course} + ${score2.course}`,
        rating: totalRating,
        slope: avgSlope,
        differential,
        player,
        date: score2.date,
        holeType: '18',
        isComposed: true,
        composedFrom: [score1.id, score2.id],
        originalScores: {
          first: {
            course: score1.course,
            score: score1.score,
            rating: score1.rating,
            slope: score1.slope,
            date: score1.date
          },
          second: {
            course: score2.course,
            score: score2.score,
            rating: score2.rating,
            slope: score2.slope,
            date: score2.date
          }
        }
      });

      // Mark both 9-hole scores as paired
      await updateDoc(doc(db, "scores", score1.id), { needsPairing: false });
      await updateDoc(doc(db, "scores", score2.id), { needsPairing: false });
    }
  } catch (e) {
    console.error("Error pairing 9-hole scores:", e);
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
  getPlayerHandicaps,
  analytics 
};