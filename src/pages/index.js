import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getPlayers, getCourses, getScores, addScore, addCourse, signIn, signOutUser, deleteScore } from 'src/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Head from 'next/head';

import { Modal, Button } from 'react-bootstrap';
import Image from 'next/image'; // Import the Image component from Next.js
import NavigationMenu from 'src/components/NavigationMenu';

// ── Pure helpers (defined outside the component so they are never re-created) ──

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

const getScoreKey = (score, index = 0) => {
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

    // Last 10 and Last 20 averages (already sorted by date desc in recentScores)
    const last10Scores = fullRoundScores.slice(0, 10);
    const last10Average = last10Scores.length > 0
      ? last10Scores.reduce((acc, s) => acc + s.score, 0) / last10Scores.length
      : 0;

    const last20Scores = fullRoundScores.slice(0, 20);
    const last20Average = last20Scores.length > 0
      ? last20Scores.reduce((acc, s) => acc + s.score, 0) / last20Scores.length
      : 0;

    return {
      name: playerName,
      handicap: parseFloat(averageHandicap.toFixed(1)),
      averageScore: parseFloat(averageScore.toFixed(1)),
      last10AverageScore: last10Scores.length > 0 ? parseFloat(last10Average.toFixed(1)) : null,
      last20AverageScore: last20Scores.length > 0 ? parseFloat(last20Average.toFixed(1)) : null,
      recentScores: recentScores
    };
  });

  return leaderboard.sort((a, b) => a.handicap - b.handicap);
};

// ─────────────────────────────────────────────────────────────────────────────

const Home = () => {
  const [players, setPlayers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [scores, setScores] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [scoreView, setScoreView] = useState('allTime');
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

  // ── Secret delete popover state ───────────────────────────────────────────
  const [deletePopover, setDeletePopover] = useState(null); // { x, y, scoreId, scoreLabel }
  const longPressTimer = useRef(null);
  const popoverRef = useRef(null);

  // ── Toast notification state ──────────────────────────────────────────────
  const [toast, setToast] = useState(null); // { message, type: 'success'|'info' }
  const toastTimer = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);
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

  // ── Memoized derived data ──────────────────────────────────────────────────

  // Sort players/courses once whenever the underlying arrays change, not on every render
  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name)),
    [players]
  );

  const sortedCourses = useMemo(
    () => [...courses].sort((a, b) => a.course.localeCompare(b.course)),
    [courses]
  );

  // Filter scores — only recomputes when scores/filterPlayer/filterCourse change
  const filteredScores = useMemo(
    () => scores.filter((score) =>
      (!filterPlayer || score.player === filterPlayer) &&
      (!filterCourse || score.course === filterCourse)
    ),
    [scores, filterPlayer, filterCourse]
  );

  // Build the highlighted-keys Set — only recomputes when scores or leaderboard change
  const highlightedScoreKeys = useMemo(() => {
    // Build a lookup map once: playerName → all their scores
    const scoresByPlayer = {};
    scores.forEach(score => {
      if (!scoresByPlayer[score.player]) scoresByPlayer[score.player] = [];
      scoresByPlayer[score.player].push(score);
    });

    const keys = new Set();
    leaderboard.forEach((entry) => {
      const playerScoreList = scoresByPlayer[entry.name] || [];
      const { selectedScores } = getSelectedDifferentialKeys(playerScoreList);
      selectedScores.forEach((score, index) => keys.add(getScoreKey(score, index)));
    });
    return keys;
  }, [scores, leaderboard]);

  // Pre-format the visible page rows to avoid repeated work inside JSX
  const pagedRows = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredScores.slice(start, start + itemsPerPage).map((score) => ({
      ...score,
      _isHighlighted: highlightedScoreKeys.has(getScoreKey(score)),
      _formattedDiff: parseFloat(score.differential).toFixed(2),
      _formattedDate: new Date(getScoreDateMs(score.date)).toLocaleDateString(),
      _typeLabel: score.isComposed ? 'Combined 9s' : score.holeType === '9' ? '9-Hole' : '18-Hole',
    }));
  }, [filteredScores, currentPage, highlightedScoreKeys]);

  // ──────────────────────────────────────────────────────────────────────────

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
    const value = e.target.value;
    if (!value) {
      setSelectedCourse('');
      setRating('');
      setSlope('');
      return;
    }
    const selected = courses.find(course => course.course === value);
    if (selected) {
      setSelectedCourse(selected.course);
      setRating(selected.rating);
      setSlope(selected.slope);
    }
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

    // Reset form fields immediately so the form feels snappy
    setScore('');
    setSelectedCourse('');
    setRating('');
    setSlope('');
    setHoleType('');
    setDatePlayed(new Date().toISOString().split('T')[0]);

    // Refresh data and show non-blocking toast
    const updatedScores = await getScores();
    setScores(updatedScores);
    setLeaderboard(calculateLeaderboard(updatedScores));

    if (holeType === '9') {
      showToast('9-hole score added! It will be combined with your next 9-hole score.', 'info');
    } else {
      showToast('Score added successfully!');
    }
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

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // ── Secret delete handlers ────────────────────────────────────────────────

  const openDeletePopover = useCallback((e, row) => {
    e.preventDefault();
    const x = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
    const y = e.clientY ?? (e.touches?.[0]?.clientY ?? 0);
    setDeletePopover({
      x,
      y,
      scoreId: row.id,
      scoreLabel: `${row.player} — ${row.course} (${row._formattedDate})`,
    });
  }, []);

  const startLongPress = useCallback((e, row) => {
    longPressTimer.current = setTimeout(() => openDeletePopover(e, row), 600);
  }, [openDeletePopover]);

  const cancelLongPress = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deletePopover) return;
    const idToRemove = deletePopover.scoreId;
    // Close popover and optimistically remove from local state immediately
    setDeletePopover(null);
    setScores((prev) => {
      const next = prev.filter((s) => s.id !== idToRemove);
      setLeaderboard(calculateLeaderboard(next));
      return next;
    });
    try {
      await deleteScore(idToRemove);
      showToast('Score removed.');
    } catch {
      // Roll back on failure by re-fetching
      const restored = await getScores();
      setScores(restored);
      setLeaderboard(calculateLeaderboard(restored));
      showToast('Failed to remove score. Please try again.', 'error');
    }
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
          <div className="content">
            <div className="logo-container">
              <div className="logo-wrapper">
                <Image src="/logo.png" alt="Logo" width={300} height={300} className="rounded-logo" />
                <div className="sparkle sparkle-1"></div>
                <div className="sparkle sparkle-2"></div>
                <div className="sparkle sparkle-3"></div>
                <div className="sparkle sparkle-4"></div>
                <div className="sparkle sparkle-5"></div>
                <div className="sparkle sparkle-6"></div>
              </div>
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
                      {sortedPlayers.map((player) => (
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
                      {sortedCourses.map((course) => (
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
                <div className="d-flex justify-content-between align-items-center mt-4 mb-3">
                  <h2 className="text-2xl font-semibold mb-0">Leaderboard</h2>
                  <select
                    id="scoreViewDropdown"
                    value={scoreView}
                    onChange={(e) => setScoreView(e.target.value)}
                    className="form-control"
                    style={{ width: 'auto' }}
                  >
                    <option value="allTime">All-time Avg Score</option>
                    <option value="last20">Last 20 Avg Score</option>
                    <option value="last10">Last 10 Avg Score</option>
                  </select>
                </div>
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Handicap</th>
                      <th>
                        {scoreView === 'last10' ? 'Last 10 Avg' :
                          scoreView === 'last20' ? 'Last 20 Avg' :
                            'All-time Avg'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => {
                      const displayScore =
                        scoreView === 'last10' ? (entry.last10AverageScore ?? '—') :
                          scoreView === 'last20' ? (entry.last20AverageScore ?? '—') :
                            entry.averageScore;
                      return (
                        <tr key={index}>
                          <td>{entry.name}</td>
                          <td>{entry.handicap}</td>
                          <td>{displayScore}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Previous Scores Table */}
                <h2 className="text-2xl font-semibold mt-4 mb-3">Previous Scores</h2>
                <div className="d-flex flex-column flex-md-row gap-3 mb-3">
                  <div className="flex-fill">
                    <label className="form-label text-muted small mb-1">Filter by Player</label>
                    <select onChange={(e) => { setFilterPlayer(e.target.value); setCurrentPage(0); }} value={filterPlayer} className="form-control">
                      <option value="">All Players</option>
                      {players.map((player) => (
                        <option key={player.id} value={player.name}>{player.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-fill">
                    <label className="form-label text-muted small mb-1">Filter by Course</label>
                    <select onChange={(e) => { setFilterCourse(e.target.value); setCurrentPage(0); }} value={filterCourse} className="form-control">
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
                      {pagedRows.map((row) => (
                        <tr
                          key={row.id}
                          data-used-for-differential={row._isHighlighted}
                          className={row._isHighlighted ? 'used-for-differential' : ''}
                          onContextMenu={(e) => openDeletePopover(e, row)}
                          onTouchStart={(e) => startLongPress(e, row)}
                          onTouchEnd={cancelLongPress}
                          onTouchMove={cancelLongPress}
                        >
                          <td className="col-player">{row.player}</td>
                          <td className="col-course">{row.course}</td>
                          <td className="col-score text-center">{row.score}</td>
                          <td className="col-type text-center">{row._typeLabel}</td>
                          <td className="col-differential text-center">{row._formattedDiff}</td>
                          <td className="col-date text-center">{row._formattedDate}</td>
                        </tr>
                      ))}
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

            {/* ── Toast notification ── */}
            {toast && (
              <div className={`app-toast app-toast--${toast.type}`} role="status">
                {toast.type === 'success' && <span className="app-toast-icon">✓</span>}
                {toast.type === 'info' && <span className="app-toast-icon">ℹ</span>}
                {toast.type === 'error' && <span className="app-toast-icon">✕</span>}
                <span>{toast.message}</span>
              </div>
            )}

            {/* ── Secret Delete Popover ── */}
            {deletePopover && (
              <>
                {/* Backdrop to dismiss */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                  onClick={() => setDeletePopover(null)}
                />
                <div
                  ref={popoverRef}
                  className="delete-popover"
                  style={{
                    position: 'fixed',
                    left: Math.min(deletePopover.x, window.innerWidth - 260),
                    top: Math.min(deletePopover.y, window.innerHeight - 130),
                    zIndex: 9999,
                  }}
                >
                  <p className="delete-popover-label">Remove this score?</p>
                  <p className="delete-popover-score">{deletePopover.scoreLabel}</p>
                  <div className="delete-popover-actions">
                    <button
                      className="delete-popover-btn delete-popover-btn--cancel"
                      onClick={() => setDeletePopover(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="delete-popover-btn delete-popover-btn--confirm"
                      onClick={handleDeleteConfirm}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </>
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