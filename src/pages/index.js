import { useState, useEffect } from 'react';
import { getPlayers, getCourses, getScores, addScore, addCourse } from 'src/firebase';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Modal, Button } from 'react-bootstrap';
import Image from 'next/image'; // Import the Image component from Next.js

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
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [passcodeEntered, setPasscodeEntered] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [holeType, setHoleType] = useState('18');
  const [currentPage, setCurrentPage] = useState(0);
  const [filterPlayer, setFilterPlayer] = useState(''); // New state for filter selection
  const itemsPerPage = 10;

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

    await addScore({
      score: parseFloat(score),
      course: selectedCourse,
      rating: parseFloat(rating),
      slope: parseFloat(slope),
      player: selectedPlayer,
      holeType: holeType
    });
    alert("Score added!");

    // Reset the form fields
    setScore('');
    setSelectedCourse('');
    setRating('');
    setSlope('');

    // Refresh the page to reflect the new data
    window.location.reload();
  };

  const handleAddCourseSubmit = async (e) => {
    e.preventDefault();
    await addCourse({ course: newCourse, rating: parseFloat(rating), slope: parseFloat(slope) });
    alert("New course added!");
    setShowAddCourseModal(false);
    // Refresh the courses list
    const courseList = await getCourses();
    setCourses(courseList);
    // Reset the form fields
    setNewCourse('');
    setRating('');
    setSlope('');
  };

  const filteredScores = filterPlayer 
    ? scores.filter((score) => score.player === filterPlayer)
    : scores;

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const totalPages = Math.ceil(filteredScores.length / itemsPerPage);

  return (
    <div className="home-container">
      <div className="overlay"></div>
      <div className="content">
        <div className="logo-container">
          <Image src="/logo.png" alt="Logo" width={300} height={300} className="rounded-logo" />
        </div>
        <h1 className="text-4xl font-semibold text-center mb-8">Guyscorp Handicap Tracking</h1>

        {!passcodeEntered ? (
          <div className="passcode-container">
            <form onSubmit={handlePasscodeSubmit} className="d-flex flex-column align-items-center mb-8 passcode-form">
              <input
                type="password"
                placeholder="Enter Passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="mb-4 p-3 form-control w-50"
              />
              <button type="submit" className="btn btn-success w-50">Submit</button>
            </form>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4 mb-8">
              <div className="form-group">
                <label className="form-label">Select a Player:</label>
                <select 
                  onChange={(e) => setSelectedPlayer(e.target.value)} 
                  value={selectedPlayer} 
                  className="form-control"
                >
                  <option value="">-- Choose a Player --</option>
                  {players.sort((a, b) => a.name.localeCompare(b.name)).map((player) => (
                    <option key={player.id} value={player.name}>{player.name}</option>
                  ))}
                </select>
              </div>

              {/* Select or Add New Course */}
              <div className="form-group">
                <label className="form-label">Select a Course or Add New:</label>
                <select 
                  onChange={handleCourseSelect} 
                  value={selectedCourse} 
                  className="form-control"
                >
                  <option value="">-- Choose a Course --</option>
                  {courses.sort((a, b) => a.course.localeCompare(b.course)).map((course) => (
                    <option key={course.id} value={course.course}>{course.course}</option>
                  ))}
                </select>
                <button 
                  type="button" 
                  onClick={() => setShowAddCourseModal(true)} 
                  className="btn btn-link mt-2"
                >
                  Add New Course
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Score:</label>
                <input 
                  type="number" 
                  placeholder="Score" 
                  value={score} 
                  onChange={(e) => setScore(e.target.value)} 
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hole Type:</label>
                <select 
                  onChange={(e) => setHoleType(e.target.value)} 
                  value={holeType} 
                  className="form-control"
                >
                  <option value="18">18 Holes</option>
                  <option value="9">9 Holes</option>
                </select>
              </div>
              <br/>
              <button 
                type="submit" 
                className="btn btn-success w-100"
              >
                Submit Score
              </button>
            </form>

            {/* Leaderboard Table */}
            <h2 className="text-2xl font-semibold mb-4">Leaderboard</h2>
            <table className="table table-bordered mb-8">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Handicap</th>
                  <th>Average 18-Hole Score</th>
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
            <h2 className="text-2xl font-semibold mb-4">Previous Scores</h2>
            <select onChange={(e) => setFilterPlayer(e.target.value)} value={filterPlayer} className="form-control mb-4">
              <option value="">-- Select Player --</option>
              {players.map((player) => (
                <option key={player.id} value={player.name}>{player.name}</option>
              ))}
            </select>

            <table className="table table-bordered mb-4">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Course</th>
                  <th>Score</th>
                  <th>Handicap</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredScores.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage).map((score) => (
                  <tr key={score.id}>
                    <td>{score.player}</td>
                    <td>{score.course}</td>
                    <td>{score.score}</td>
                    <td>{score.differential}</td>
                    <td>{new Date(score.date.seconds * 1000).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination d-flex justify-content-center gap-4">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0} className="btn btn-success">Previous</button>
              <span className="text-lg">Page {currentPage + 1} of {totalPages}</span>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages - 1} className="btn btn-success">Next</button>
            </div>
          </>
        )}

        {/* Add Course Modal */}
        <Modal show={showAddCourseModal} onHide={() => setShowAddCourseModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Add New Course</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <form onSubmit={handleAddCourseSubmit}>
              <div className="form-group">
                <label className="form-label">New Course Name:</label>
                <input 
                  type="text" 
                  placeholder="Course Name" 
                  value={newCourse} 
                  onChange={(e) => setNewCourse(e.target.value)} 
                  className="form-control" 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Course Rating:</label>
                <input 
                  type="number" 
                  placeholder="Rating" 
                  value={rating} 
                  onChange={(e) => setRating(e.target.value)} 
                  className="form-control" 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Course Slope:</label>
                <input 
                  type="number" 
                  placeholder="Slope" 
                  value={slope} 
                  onChange={(e) => setSlope(e.target.value)} 
                  className="form-control" 
                />
              </div>
              <Button variant="success" type="submit">
                Add Course
              </Button>
            </form>
          </Modal.Body>
        </Modal>
      </div>
    </div>
  );
};

export default Home;