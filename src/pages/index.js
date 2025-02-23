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
  const [holeType, setHoleType] = useState('18'); // Hole type state
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 15; // Changed to 15 rows per page

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

  // Handicap Calculation for 9-hole and 18-hole scores
  const calculateDifferential = (score, rating, slope, holeType) => {
    let differential;

    if (holeType === '18') {
      // Standard calculation for 18-hole scores
      differential = ((score - rating) * 113) / slope;
    } else {
      // For 9-hole scores, adjust by halving the rating and doubling the differential
      const adjustedRating = rating / 2;
      differential = ((score - adjustedRating) * 113) / slope;
      differential *= 2; // Adjust to 18-hole equivalent
    }

    // Apply the 0.96 multiplier to all differentials
    return parseFloat((differential * 0.96).toFixed(2));
  };

  const calculateLeaderboard = (scores) => {
    const playerScores = {};

    scores.forEach(score => {
      if (!playerScores[score.player]) {
        playerScores[score.player] = { differentials: [], totalScore: 0, totalRounds: 0 };
      }
      playerScores[score.player].differentials.push(score.differential);
      playerScores[score.player].totalScore += score.score;
      playerScores[score.player].totalRounds += 1;
    });

    const leaderboard = Object.keys(playerScores).map(playerName => {
      const { differentials, totalScore, totalRounds } = playerScores[playerName];
      const sortedDifferentials = differentials.sort((a, b) => a - b);
      const lowestDifferentials = sortedDifferentials.slice(0, Math.min(8, differentials.length));
      const averageHandicap = lowestDifferentials.reduce((acc, diff) => acc + diff, 0) / lowestDifferentials.length;

      const averageScore = totalScore / totalRounds;

      return {
        name: playerName,
        handicap: parseFloat(averageHandicap.toFixed(2)),
        averageScore: parseFloat(averageScore.toFixed(2)),
      };
    });

    return leaderboard.sort((a, b) => a.handicap - b.handicap);
  };

  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    if (passcode === process.env.NEXT_PUBLIC_PASSCODE) {
      sessionStorage.setItem('passcodeVerified', true);
      setPasscodeEntered(true);
    } else {
      alert("Incorrect passcode!");
    }
  };

  const handleCourseSelect = (e) => {
    const selected = courses.find(course => course.course === e.target.value);
    setSelectedCourse(selected.course);
    setRating(selected.rating);
    setSlope(selected.slope);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passcodeEntered) {
      alert("You must enter the passcode first!");
      return;
    }

    const differential = calculateDifferential(score, rating, slope, holeType);

    if (addingNewCourse) {
      await addCourse({ course: newCourse, rating: parseFloat(rating), slope: parseFloat(slope) });
      alert("New course added!");
      setAddingNewCourse(false); // Reset the state after adding a course
    } else {
      await addScore({ score: parseFloat(score), course: selectedCourse, rating: parseFloat(rating), slope: parseFloat(slope), player: selectedPlayer, differential });
      alert("Score added!");
    }

    setScore('');
    setNewCourse('');
    setRating('');
    setSlope('');
    setAddingNewCourse(false);
  };

  const filteredScores = selectedPlayer 
    ? scores.filter((score) => score.player === selectedPlayer)
    : scores;

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const totalPages = Math.ceil(filteredScores.length / itemsPerPage);

  return (
    <div>
      <h1>Handicap Tracking</h1>

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
          <form onSubmit={handleSubmit}>
            <label>Select a Player:</label>
            <select onChange={(e) => setSelectedPlayer(e.target.value)} value={selectedPlayer}>
              <option value="">-- Choose a Player --</option>
              {players
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((player) => (
                  <option key={player.id} value={player.name}>
                    {player.name}
                  </option>
                ))}
            </select>

            {/* Select or Add New Course */}
            <label>Select a Course or Add New:</label>
            <select onChange={handleCourseSelect} value={selectedCourse} disabled={addingNewCourse}>
              <option value="">-- Choose a Course --</option>
              {courses.map((course) => (
                <option key={course.id} value={course.course}>
                  {course.course}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setAddingNewCourse(true)}>Add New Course</button>

            {addingNewCourse && (
              <>
                <label>New Course Name:</label>
                <input
                  type="text"
                  placeholder="Course Name"
                  value={newCourse}
                  onChange={(e) => setNewCourse(e.target.value)}
                />
                <label>Course Rating:</label>
                <input
                  type="number"
                  placeholder="Rating"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                />
                <label>Course Slope:</label>
                <input
                  type="number"
                  placeholder="Slope"
                  value={slope}
                  onChange={(e) => setSlope(e.target.value)}
                />
              </>
            )}

            <label>Score:</label>
            <input type="number" placeholder="Score" value={score} onChange={(e) => setScore(e.target.value)} />

            <label>Hole Type:</label>
            <select onChange={(e) => setHoleType(e.target.value)} value={holeType}>
              <option value="18">18 Holes</option>
              <option value="9">9 Holes</option>
            </select>

            <button type="submit">Submit Score</button>
          </form>

           {/* Leaderboard Table */}
           <h2>Leaderboard</h2>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Handicap</th>
                <th>Average Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => (
                <tr key={index}>
                  <td>{entry.name}</td>
                  <td>{entry.handicap}</td>
                  <td>{entry.averageScore}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Previous Scores Table */}
          <h2>Previous Scores</h2>
          <select onChange={(e) => setSelectedPlayer(e.target.value)} value={selectedPlayer}>
            <option value="">-- Select Player --</option>
            {players.map((player) => (
              <option key={player.id} value={player.name}>
                {player.name}
              </option>
            ))}
          </select>

          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Course</th>
                <th>Score</th>
                <th>Handicap</th> {/* Added Handicap column */}
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredScores
                .slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage)
                .map((score) => (
                  <tr key={score.id}>
                    <td>{score.player}</td>
                    <td>{score.course}</td>
                    <td>{score.score}</td>
                    <td>{score.differential}</td> {/* Showing differential (Handicap) */}
                    <td>{new Date(score.date.seconds * 1000).toLocaleDateString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          <div>
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0}>Previous</button>
            <span>Page {currentPage + 1} of {totalPages}</span>
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages - 1}>Next</button>
          </div>
        </>
      )}
    </div>
  );
};

export default Home;