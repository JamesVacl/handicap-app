import { useState, useEffect } from 'react';
import { getPlayers, getCourses, getScores, addScore, addCourse } from 'src/firebase';

const Home = () => {
  const [players, setPlayers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [scores, setScores] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [score, setScore] = useState('');
  const [rating, setRating] = useState('');
  const [slope, setSlope] = useState('');
  const [newCourse, setNewCourse] = useState('');
  const [addingNewCourse, setAddingNewCourse] = useState(false);
  const [passcodeEntered, setPasscodeEntered] = useState(false);
  const [passcode, setPasscode] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem('passcodeVerified')) {
      setPasscodeEntered(true);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const playerList = await getPlayers();
      setPlayers(playerList);

      const scoreList = await getScores();
      setScores(scoreList);

      const courseList = await getCourses();
      setCourses(courseList);

      const leaderboardData = calculateLeaderboard(scoreList);
      setLeaderboard(leaderboardData);
    };
    fetchData();
  }, []);

  // Leaderboard Calculation
  const calculateLeaderboard = (scores) => {
    const playerScores = {};

    // Group scores by player name
    scores.forEach(score => {
      if (!playerScores[score.player]) {
        playerScores[score.player] = [];
      }
      playerScores[score.player].push(score.differential);
    });

    const leaderboard = Object.keys(playerScores).map(playerName => {
      const differentials = playerScores[playerName].sort((a, b) => a - b);
      const lowestDifferentials = differentials.slice(0, Math.min(8, differentials.length));
      const averageHandicap = lowestDifferentials.reduce((acc, diff) => acc + diff, 0) / lowestDifferentials.length;

      return {
        name: playerName,
        handicap: parseFloat(averageHandicap.toFixed(2))
      };
    });

    return leaderboard.sort((a, b) => a.handicap - b.handicap);
  };

  // Handle Passcode Submission
  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    if (passcode === process.env.NEXT_PUBLIC_PASSCODE) {
      sessionStorage.setItem('passcodeVerified', true);
      setPasscodeEntered(true);
    } else {
      alert("Incorrect passcode!");
    }
  };

  // Handle course selection
  const handleCourseSelect = (e) => {
    const selected = courses.find(course => course.course === e.target.value);
    setSelectedCourse(selected.course);
    setRating(selected.rating);
    setSlope(selected.slope);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passcodeEntered) {
      alert("You must enter the passcode first!");
      return;
    }

    if (addingNewCourse) {
      await addCourse({ course: newCourse, rating: parseFloat(rating), slope: parseFloat(slope) });
      alert("New course added!");
    } else {
      await addScore({ score: parseFloat(score), course: selectedCourse, rating: parseFloat(rating), slope: parseFloat(slope), player: selectedPlayer });
      alert("Score added!");
    }

    setScore('');
    setNewCourse('');
    setRating('');
    setSlope('');
    setAddingNewCourse(false);
  };

  return (
    <div>
      <h1>Handicap Tracking</h1>
  
      {/* Passcode Entry */}
      {!passcodeEntered ? (
        <form onSubmit={handlePasscodeSubmit}>
          <input
            type="password"
            placeholder="Enter Passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />
          <button type="submit">Submit</button>
        </form>
      ) : (
        <>
          {/* Score Submission Form */}
          <form onSubmit={handleSubmit}>
            <label>Select a Player:</label>
            <select onChange={(e) => setSelectedPlayer(e.target.value)} value={selectedPlayer}>
              <option value="">-- Choose a Player --</option>
              {players.map((player) => (
                <option key={player.id} value={player.name}>
                  {player.name}
                </option>
              ))}
            </select>
  
            <label>Select a Course:</label>
            <select onChange={handleCourseSelect} value={selectedCourse}>
              <option value="">-- Choose a Course --</option>
              {courses.map((course) => (
                <option key={course.id} value={course.course}>
                  {course.course}
                </option>
              ))}
            </select>
  
            <input type="number" placeholder="Score" value={score} onChange={(e) => setScore(e.target.value)} />
            <button type="submit">Submit Score</button>
          </form>
  
          {/* Previous Scores */}
          <h2>Previous Scores</h2>
          <ul>
            {scores.map((score) => (
              <li key={score.id}>
                {score.player} - {score.course}: {score.score} 
                <br />
                Date: {new Date(score.date.seconds * 1000).toLocaleDateString()} {/* Format date */}
              </li>
            ))}
          </ul>
  
          {/* Leaderboard */}
          <h2>Leaderboard</h2>
          <ul>
            {leaderboard.map((entry, index) => (
              <li key={index}>{entry.name}: {entry.handicap}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default Home;