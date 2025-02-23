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
  const [holeType, setHoleType] = useState('18');
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 15;

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

  const calculateDifferential = (score, rating, slope, holeType) => {
    let differential;

    if (holeType === '18') {
      differential = ((score - rating) * 113) / slope;
    } else {
      const adjustedRating = rating / 2;
      differential = ((score - adjustedRating) * 113) / slope;
      differential *= 2; // Adjust to 18-hole equivalent
    }

    return parseFloat((differential * 0.96).toFixed(2)); // Apply 0.96 multiplier
  };

  const calculateLeaderboard = (scores) => {
    const playerScores = {};
  
    scores.forEach(score => {
      if (!playerScores[score.player]) {
        playerScores[score.player] = { differentials: [], totalScore: 0, totalRounds: 0, total18HoleScores: 0 };
      }
  
      // Add to differentials for both 9-hole and 18-hole scores
      playerScores[score.player].differentials.push(score.differential);
  
      // Only calculate total score and rounds for 18-hole scores
      if (score.holeType === '18') {
        playerScores[score.player].totalScore += score.score;
        playerScores[score.player].totalRounds += 1;
        playerScores[score.player].total18HoleScores += 1;
      }
    });
  
    const leaderboard = Object.keys(playerScores).map(playerName => {
      const { differentials, totalScore, totalRounds, total18HoleScores } = playerScores[playerName];
      const sortedDifferentials = differentials.sort((a, b) => a - b);
      const lowestDifferentials = sortedDifferentials.slice(0, Math.min(8, differentials.length));
      const averageHandicap = lowestDifferentials.reduce((acc, diff) => acc + diff, 0) / lowestDifferentials.length;
  
      // Calculate the average 18-hole score (ignore 9-hole scores for this)
      const averageScore = total18HoleScores > 0 ? totalScore / total18HoleScores : 0;
  
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
    setAddingNewCourse(false);
  } else {
    await addScore({
      score: parseFloat(score),
      course: selectedCourse,
      rating: parseFloat(rating),
      slope: parseFloat(slope),
      player: selectedPlayer,
      differential,
      holeType: holeType
    });
    alert("Score added!");
  }

  // Reset the form fields
  setScore('');
  setNewCourse('');
  setRating('');
  setSlope('');
  setAddingNewCourse(false);

  // Refresh the page to reflect the new data
  window.location.reload();
};

  const filteredScores = selectedPlayer 
    ? scores.filter((score) => score.player === selectedPlayer)
    : scores;

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const totalPages = Math.ceil(filteredScores.length / itemsPerPage);

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-4xl font-semibold text-center mb-8">Guyscorp Handicap Tracking</h1>

      {!passcodeEntered ? (
        <form onSubmit={handlePasscodeSubmit} className="flex flex-col items-center mb-8">
          <input
            type="password"
            placeholder="Enter Passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="mb-4 p-3 border border-gray-300 rounded-md w-72"
          />
          <button type="submit" className="bg-blue-500 text-white py-2 px-6 rounded-md w-72">Submit</button>
        </form>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            <div>
              <label className="block text-lg text-black">Select a Player:</label>
              <select 
                onChange={(e) => setSelectedPlayer(e.target.value)} 
                value={selectedPlayer} 
                className="w-full p-3 border border-gray-300 rounded-md text-black"
              >
                <option value="">-- Choose a Player --</option>
                {players.sort((a, b) => a.name.localeCompare(b.name)).map((player) => (
                  <option key={player.id} value={player.name}>{player.name}</option>
                ))}
              </select>
            </div>

            {/* Select or Add New Course */}
            <div>
              <label className="block text-lg text-black">Select a Course or Add New:</label>
              <select 
                onChange={handleCourseSelect} 
                value={selectedCourse} 
                disabled={addingNewCourse} 
                className="w-full p-3 border border-gray-300 rounded-md text-black"
              >
                <option value="">-- Choose a Course --</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.course}>{course.course}</option>
                ))}
              </select>
              <button 
                type="button" 
                onClick={() => setAddingNewCourse(true)} 
                className="mt-2 text-blue-500"
              >
                Add New Course
              </button>
            </div>

            {addingNewCourse && (
              <>
                <div>
                  <label className="block text-lg text-black">New Course Name:</label>
                  <input 
                    type="text" 
                    placeholder="Course Name" 
                    value={newCourse} 
                    onChange={(e) => setNewCourse(e.target.value)} 
                    className="w-full p-3 border border-gray-300 rounded-md text-black" 
                  />
                </div>
                <div>
                  <label className="block text-lg text-black">Course Rating:</label>
                  <input 
                    type="number" 
                    placeholder="Rating" 
                    value={rating} 
                    onChange={(e) => setRating(e.target.value)} 
                    className="w-full p-3 border border-gray-300 rounded-md text-black" 
                  />
                </div>
                <div>
                  <label className="block text-lg text-black">Course Slope:</label>
                  <input 
                    type="number" 
                    placeholder="Slope" 
                    value={slope} 
                    onChange={(e) => setSlope(e.target.value)} 
                    className="w-full p-3 border border-gray-300 rounded-md text-black" 
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-lg text-black">Score:</label>
              <input 
                type="number" 
                placeholder="Score" 
                value={score} 
                onChange={(e) => setScore(e.target.value)} 
                className="w-full p-3 border border-gray-300 rounded-md text-black" 
              />
            </div>

            <div>
              <label className="block text-lg text-black">Hole Type:</label>
              <select 
                onChange={(e) => setHoleType(e.target.value)} 
                value={holeType} 
                className="w-full p-3 border border-gray-300 rounded-md text-black"
              >
                <option value="18">18 Holes</option>
                <option value="9">9 Holes</option>
              </select>
            </div>

            <button 
              type="submit" 
              className="w-full bg-blue-500 text-white py-3 rounded-md"
            >
              Submit Score
            </button>
          </form>

          {/* Leaderboard Table */}
          <h2 className="text-2xl font-semibold mb-4">Leaderboard</h2>
          <table className="w-full table-auto mb-8 border-collapse">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left border border-gray-300">Player</th>
                <th className="px-4 py-3 text-left border border-gray-300">Handicap</th>
                <th className="px-4 py-3 text-left border border-gray-300">Average 18-Hole Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 border border-gray-300">{entry.name}</td>
                  <td className="px-4 py-3 border border-gray-300">{entry.handicap}</td>
                  <td className="px-4 py-3 border border-gray-300">{entry.averageScore}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Previous Scores Table */}
          <h2 className="text-2xl font-semibold mb-4">Previous Scores</h2>
          <h3 className="text-lg font-medium">Filter by Player</h3>
          <select onChange={(e) => setSelectedPlayer(e.target.value)} value={selectedPlayer} className="w-full p-3 border border-gray-300 rounded-md mb-4">
            <option value="">-- Select Player --</option>
            {players.map((player) => (
              <option key={player.id} value={player.name}>{player.name}</option>
            ))}
          </select>

          <table className="w-full table-auto mb-4 border-collapse">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left border border-gray-300">Player</th>
                <th className="px-4 py-3 text-left border border-gray-300">Course</th>
                <th className="px-4 py-3 text-left border border-gray-300">Score</th>
                <th className="px-4 py-3 text-left border border-gray-300">Handicap</th>
                <th className="px-4 py-3 text-left border border-gray-300">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredScores.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage).map((score) => (
                <tr key={score.id}>
                  <td className="px-4 py-3 border border-gray-300">{score.player}</td>
                  <td className="px-4 py-3 border border-gray-300">{score.course}</td>
                  <td className="px-4 py-3 border border-gray-300">{score.score}</td>
                  <td className="px-4 py-3 border border-gray-300">{score.differential}</td>
                  <td className="px-4 py-3 border border-gray-300">{new Date(score.date.seconds * 1000).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination flex justify-center gap-4">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0} className="bg-blue-500 text-white py-2 px-4 rounded-md">Previous</button>
            <span className="text-lg">Page {currentPage + 1} of {totalPages}</span>
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages - 1} className="bg-blue-500 text-white py-2 px-4 rounded-md">Next</button>
          </div>
        </>
      )}
    </div>
  );
};

export default Home;