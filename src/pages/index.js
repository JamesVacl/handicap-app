import { useState, useEffect } from 'react';
import { getPlayers, getCourses, getScores, addScore, addCourse, signIn, signOutUser } from 'src/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Modal, Button } from 'react-bootstrap';
import Image from 'next/image'; // Import the Image component from Next.js
import NavigationMenu from 'src/components/NavigationMenu';

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
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [holeType, setHoleType] = useState('18');
  const [handicapIndex, setHandicapIndex] = useState(''); // New state for Handicap Index
  const [currentPage, setCurrentPage] = useState(0);
  const [filterPlayer, setFilterPlayer] = useState(''); // New state for filter selection
  const [filterCourse, setFilterCourse] = useState(''); // New state for filter selection
  const [datePlayed, setDatePlayed] = useState(new Date().toISOString().split('T')[0]);
  const itemsPerPage = 10;

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthenticated(true);
      } else {
        setAuthenticated(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (authenticated) {
        const playerList = await getPlayers();
        setPlayers(playerList);

        const scoreList = await getScores();
        setScores(scoreList);

        const courseList = await getCourses();
        setCourses(courseList);

        const leaderboardData = calculateLeaderboard(scoreList);
        setLeaderboard(leaderboardData);
      }
    };
    fetchData();
  }, [authenticated]);

  const calculateDifferential = (score, rating, slope, holeType, handicapIndex) => {
    let differential;

    if (holeType === '18') {
      differential = ((score - rating) * 113) / slope;
    } else {
      // Calculate Net Score
      const netScore = (score -(handicapIndex*0.5))
      // Calculate 9-hole score differential
      const scoreDifferential = ((netScore - rating) * 113) / slope;
      // Calculate estimated score differential
      const estimatedDifferential = (handicapIndex * 0.52) + 1.197;
      // Combine both differentials
      differential = scoreDifferential + estimatedDifferential;
    }

    return parseFloat((differential * 0.96).toFixed(1)); // Apply 0.96 multiplier
  };

  const calculateLeaderboard = (scores) => {
    const playerScores = {};

    scores.forEach(score => {
      if (!playerScores[score.player]) {
        playerScores[score.player] = [];
      }
      playerScores[score.player].push(score);
    });

    const leaderboard = Object.keys(playerScores).map(playerName => {
      const playerScoreList = playerScores[playerName];

      // Sort scores by date in descending order (most recent first)
      playerScoreList.sort((a, b) => new Date(b.date.seconds * 1000) - new Date(a.date.seconds * 1000));

      // Take the 20 most recent scores
      const recentScores = playerScoreList.slice(0, 20);

      // Sort the recent scores by differential in ascending order (lowest first)
      const sortedDifferentials = recentScores.map(score => score.differential).sort((a, b) => a - b);

      // Take the 8 lowest differentials
      const lowestDifferentials = sortedDifferentials.slice(0, 8);
      const averageHandicap = lowestDifferentials.reduce((acc, diff) => acc + diff, 0) / lowestDifferentials.length;

      // Calculate the average 18-hole score (ignore 9-hole scores for this)
      const total18HoleScores = recentScores.filter(score => score.holeType === '18');
      const totalScore = total18HoleScores.reduce((acc, score) => acc + score.score, 0);
      const averageScore = total18HoleScores.length > 0 ? totalScore / total18HoleScores.length : 0;

      // Mark the scores used for differential calculation
      recentScores.forEach(score => {
        score.isUsedForDifferential = lowestDifferentials.includes(score.differential);
      });

      return {
        name: playerName,
        handicap: parseFloat(averageHandicap.toFixed(1)),
        averageScore: parseFloat(averageScore.toFixed(1)),
        recentScores: recentScores
      };
    });

    return leaderboard.sort((a, b) => a.handicap - b.handicap);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      await signIn(email, password);
      setAuthenticated(true);
    } catch (error) {
      alert("Authentication failed!");
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setAuthenticated(false);
  };

  const handleCourseSelect = (e) => {
    const selected = courses.find(course => course.course === e.target.value);
    setSelectedCourse(selected.course);
    setRating(selected.rating);
    setSlope(selected.slope);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!authenticated) {
      alert("You must be authenticated first!");
      return;
    }

    if (!selectedPlayer || !selectedCourse || !score || !rating || !slope || !datePlayed) {
      alert("All fields are required!");
      return;
    }

    await addScore({
      score: parseFloat(score),
      course: selectedCourse,
      rating: parseFloat(rating),
      slope: parseFloat(slope),
      player: selectedPlayer,
      holeType: holeType,
      handicapIndex: holeType === '9' ? parseFloat(handicapIndex) : null,
      date: new Date(datePlayed) // Convert string date to Date object
    });
    alert("Score added!");

    // Reset the form fields
    setScore('');
    setSelectedCourse('');
    setRating('');
    setSlope('');
    setHandicapIndex('');
    setDatePlayed(new Date().toISOString().split('T')[0]);

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

  const filteredScores = scores.filter((score) => {
    return (
      (!filterPlayer || score.player === filterPlayer) &&
      (!filterCourse || score.course === filterCourse)
    );
  });

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const totalPages = Math.ceil(filteredScores.length / itemsPerPage);

  return (
    <div className="app-wrapper">
      {authenticated && <NavigationMenu />}
      <div className="home-container">
        <div className="overlay"></div>
        <div className="content">
          <div className="logo-container">
            <Image src="/logo.png" alt="Logo" width={300} height={300} className="rounded-logo" />
          </div>
          <h1 className="text-4xl font-semibold text-center mb-8 cursive-font">Guyscorp Handicap Tracking</h1>

          {!authenticated ? (
            <div className="auth-container">
              <form onSubmit={handleSignIn} className="d-flex flex-column align-items-center mb-8 auth-form">
                <input
                  type="email"
                  placeholder="Enter Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mb-4 p-3 form-control w-50"
                />
                <input
                  type="password"
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mb-4 p-3 form-control w-50"
                />
                <button type="submit" className="btn btn-success w-50">Sign In</button>
              </form>
            </div>
          ) : (
            <div className="content">
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

                {holeType === '9' && (
                  <div className="form-group">
                    <label className="form-label">Handicap Index:</label>
                    <input 
                      type="number" 
                      placeholder="Handicap Index" 
                      value={handicapIndex} 
                      onChange={(e) => setHandicapIndex(e.target.value)} 
                      className="form-control" 
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Date Played:</label>
                  <input 
                    type="date" 
                    value={datePlayed} 
                    onChange={(e) => setDatePlayed(e.target.value)} 
                    className="form-control" 
                  />
                </div>

                <br/>
                <button 
                  type="submit" 
                  className="btn btn-success w-100"
                >
                  Submit Score
                </button>
              </form>
              
              <br/>


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

              <select onChange={(e) => setFilterCourse(e.target.value)} value={filterCourse} className="form-control mb-4">
                <option value="">-- Select Course --</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.course}>{course.course}</option>
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
                    <tr key={score.id} style={{ color: score.isUsedForDifferential ? 'red' : 'black' }}>
                      <td style={{ color: score.isUsedForDifferential ? 'red' : 'black' }}>{score.player}</td>
                      <td style={{ color: score.isUsedForDifferential ? 'red' : 'black' }}>{score.course}</td>
                      <td style={{ color: score.isUsedForDifferential ? 'red' : 'black' }}>{score.score}</td>
                      <td style={{ color: score.isUsedForDifferential ? 'red' : 'black' }}>{score.differential}</td>
                      <td style={{ color: score.isUsedForDifferential ? 'red' : 'black' }}>{new Date(score.date.seconds * 1000).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pagination d-flex justify-content-center gap-4">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0} className="btn btn-success">Previous</button>
                <span className="text-lg">Page {currentPage + 1} of {totalPages}</span>
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages - 1} className="btn btn-success">Next</button>
              </div>
            </div>
          )}

          {/* Add Course Modal */}
          <Modal show={showAddCourseModal} onHide={() => setShowAddCourseModal(false)}>
            <Modal.Header closeButton>
              <Modal.Title>Add New Course</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p>Visit <a href="https://ncrdb.usga.org" target="_blank" rel="noopener noreferrer">USGA</a> for rating and slope information.</p>
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
                <br />
                <Button variant="success" type="submit">
                  Add Course
                </Button>
              </form>
            </Modal.Body>
          </Modal>
        </div>
      </div>
    </div>
  );
};

export default Home;