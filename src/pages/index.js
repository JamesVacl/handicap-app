import { useState, useEffect } from 'react';
import { getPlayers, getCourses, getScores, addScore, addCourse, signIn, signOutUser } from 'src/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Head from 'next/head';

import { Modal, Button } from 'react-bootstrap';
import Image from 'next/image'; // Import the Image component from Next.js
import NavigationMenu from 'src/components/NavigationMenu';

const Home = () => {
  const MAX_RECENT_ROUNDS = 20;
  const DIFFERENTIALS_USED_COUNT = 8;

  const getScoreDateMs = (scoreDate) => {
    if (!scoreDate) return 0;
    if (typeof scoreDate.toMillis === 'function') return scoreDate.toMillis();
    if (typeof scoreDate.seconds === 'number') return scoreDate.seconds * 1000;
    if (scoreDate instanceof Date) return scoreDate.getTime();

    const parsed = new Date(scoreDate).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const getScoreKey = (score, index) => {
    if (score.id) return score.id;
    return `${score.player}-${getScoreDateMs(score.date)}-${score.differential}-${index}`;
  };

  const getSelectedDifferentialKeys = (playerScoreList) => {
    const eligibleScores = playerScoreList
      .filter((score) => score?.differential !== null && (score.holeType === '18' || score.isComposed))
      .sort((a, b) => getScoreDateMs(b.date) - getScoreDateMs(a.date))
      .slice(0, MAX_RECENT_ROUNDS);

    const lowestDifferentials = [...eligibleScores]
      .sort((a, b) => {
        if (a.differential === b.differential) {
          return getScoreDateMs(b.date) - getScoreDateMs(a.date);
        }
        return a.differential - b.differential;
      })
      .slice(0, DIFFERENTIALS_USED_COUNT);

    return {
      recentScores: eligibleScores,
      selectedScores: lowestDifferentials
    };
  };

  const [players, setPlayers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [scores, setScores] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [score, setScore] = useState('');
  const [rating, setRating] = useState('');
  const [slope, setSlope] = useState('');
  const [newCourse, setNewCourse] = useState('');
  const [newCourseRating, setNewCourseRating] = useState('');
  const [newCourseSlope, setNewCourseSlope] = useState('');
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [holeType, setHoleType] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [filterPlayer, setFilterPlayer] = useState(''); // New state for filter selection
  const [filterCourse, setFilterCourse] = useState(''); // New state for filter selection
  const [datePlayed, setDatePlayed] = useState(() => {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().split('T')[0];
  });
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

  // Load saved credentials on component mount
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('guyscorp_email');
      const savedRemember = localStorage.getItem('guyscorp_remember');
      
      if (savedEmail && savedRemember === 'true') {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (error) {
      // Ignore localStorage errors (e.g., in private browsing)
    }
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
        setLoading(false);
      } else {
        setLoading(false);
      }
    };
    fetchData();
  }, [authenticated]);

  const calculateLeaderboard = (scores) => {
    const playerScores = {};

    // First group scores by player
    scores.forEach(score => {
      if (!playerScores[score.player]) {
        playerScores[score.player] = [];
      }
      playerScores[score.player].push(score);
    });

    const leaderboard = Object.keys(playerScores).map(playerName => {
      const playerScoreList = playerScores[playerName];
      const { recentScores, selectedScores } = getSelectedDifferentialKeys(playerScoreList);
      const averageHandicap = selectedScores.length > 0
        ? selectedScores.reduce((acc, score) => acc + score.differential, 0) / selectedScores.length
        : 0;

      // Calculate average score from full rounds only
      const fullRoundScores = recentScores.filter(score => score.holeType === '18' || score.isComposed);
      const totalScore = fullRoundScores.reduce((acc, score) => acc + score.score, 0);
      const averageScore = fullRoundScores.length > 0 ? totalScore / fullRoundScores.length : 0;

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
      
      // Handle remember me functionality
      if (rememberMe) {
        localStorage.setItem('guyscorp_email', email);
        localStorage.setItem('guyscorp_remember', 'true');
      } else {
        localStorage.removeItem('guyscorp_email');
        localStorage.removeItem('guyscorp_remember');
      }
    } catch (error) {
      alert("Authentication failed!");
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setAuthenticated(false);
    
    // Clear saved credentials on sign out
    try {
      localStorage.removeItem('guyscorp_email');
      localStorage.removeItem('guyscorp_remember');
    } catch (error) {
      // Ignore localStorage errors
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
    if (!authenticated) {
      alert("You must be authenticated first!");
      return;
    }

    if (!selectedPlayer || !selectedCourse || !score || !rating || !slope || !datePlayed || !holeType) {
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
      date: new Date(`${datePlayed}T12:00:00`) // Add noon time to prevent timezone issues
    });

    // Customize alert based on hole type
    if (holeType === '9') {
      alert("9-hole score added! It will be combined with your next 9-hole score for handicap calculation.");
    } else {
      alert("18-hole score added!");
    }

    // Reset form fields
    setScore('');
    setSelectedCourse('');
    setRating('');
    setSlope('');
    setHoleType('');
    setDatePlayed(new Date().toISOString().split('T')[0]);

    // Refresh data
    const updatedScores = await getScores();
    setScores(updatedScores);
    const updatedLeaderboard = calculateLeaderboard(updatedScores);
    setLeaderboard(updatedLeaderboard);
  };

  const handleAddCourseSubmit = async (e) => {
    e.preventDefault();
    await addCourse({ course: newCourse, rating: parseFloat(newCourseRating), slope: parseFloat(newCourseSlope) });
    alert("New course added!");
    setShowAddCourseModal(false);
    // Refresh the courses list
    const courseList = await getCourses();
    setCourses(courseList);
    // Reset the form fields
    setNewCourse('');
    setNewCourseRating('');
    setNewCourseSlope('');
  };

  const filteredScores = scores.filter((score) => {
    return (
      (!filterPlayer || score.player === filterPlayer) &&
      (!filterCourse || score.course === filterCourse)
    );
  });

  const highlightedScoreKeys = new Set(
    leaderboard.flatMap((entry) => {
      const playerScoreList = scores.filter((score) => score.player === entry.name);
      const { selectedScores } = getSelectedDifferentialKeys(playerScoreList);
      return selectedScores.map((score, index) => getScoreKey(score, index));
    })
  );

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const totalPages = Math.ceil(filteredScores.length / itemsPerPage);

  return (
    <>
      <Head>
        <title>Guyscorp Golf - Handicap Tracking</title>
        <meta name="description" content="Track golf handicaps, scores, and tournament standings for the Guyscorp golf group." />
      </Head>
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
                <div className="form-check mb-3 w-50">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="rememberMe">
                    Remember me (stay logged in)
                  </label>
                </div>
                <button type="submit" className="btn btn-success w-50">Sign In</button>
              </form>
            </div>
          ) : loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="text-muted mt-3">Loading your data...</p>
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
                    <option value="">-- Select Hole Type --</option>
                    <option value="18">18 Holes</option>
                    <option value="9">9 Holes</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Date Played:</label>
                  <input 
                    type="date" 
                    value={datePlayed} 
                    onChange={(e) => setDatePlayed(e.target.value)} 
                    className="form-control" 
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-success w-100 mt-3"
                >
                  Submit Score
                </button>
              </form>

              {/* Leaderboard Table */}
              <h2 className="text-2xl font-semibold mt-4 mb-3">Leaderboard</h2>
              <table className="table table-bordered">
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
              <h2 className="text-2xl font-semibold mt-4 mb-3">Previous Scores</h2>
              <div className="d-flex gap-3 mb-3">
                <div className="flex-fill">
                  <label className="form-label text-muted small mb-1">Filter by Player</label>
                  <select onChange={(e) => setFilterPlayer(e.target.value)} value={filterPlayer} className="form-control">
                    <option value="">All Players</option>
                    {players.map((player) => (
                      <option key={player.id} value={player.name}>{player.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-fill">
                  <label className="form-label text-muted small mb-1">Filter by Course</label>
                  <select onChange={(e) => setFilterCourse(e.target.value)} value={filterCourse} className="form-control">
                    <option value="">All Courses</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.course}>{course.course}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="table-responsive-wrapper">
                <table className="table table-bordered table-hover scores-table">
                  <thead>
                    <tr>
                      <th className="col-player">Player</th>
                      <th className="col-course">Course</th>
                      <th className="col-score text-center">Score</th>
                      <th className="col-type text-center">Type</th>
                      <th className="col-differential text-center">Diff</th>
                      <th className="col-date text-center">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScores.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage).map((score) => {
                      const isUsedForDifferential = highlightedScoreKeys.has(getScoreKey(score));
                      return (
                      <tr 
                        key={score.id} 
                        data-used-for-differential={isUsedForDifferential}
                        className={isUsedForDifferential ? 'used-for-differential' : ''}
                      >
                        <td className="col-player">{score.player}</td>
                        <td className="col-course">{score.course}</td>
                        <td className="col-score text-center">{score.score}</td>
                        <td className="col-type text-center">
                          {score.isComposed ? 'Combined 9s' : 
                          score.holeType === '9' ? '9-Hole' : '18-Hole'}
                        </td>
                        <td className="col-differential text-center">
                          {parseFloat(score.differential).toFixed(2)}
                        </td>
                        <td className="col-date text-center">
                          {new Date(getScoreDateMs(score.date)).toLocaleDateString()}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pagination d-flex justify-content-center align-items-center gap-3 mt-3">
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
                    value={newCourseRating} 
                    onChange={(e) => setNewCourseRating(e.target.value)} 
                    className="form-control" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Course Slope:</label>
                  <input 
                    type="number" 
                    placeholder="Slope" 
                    value={newCourseSlope} 
                    onChange={(e) => setNewCourseSlope(e.target.value)} 
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
    </>
  );
};

export default Home;