import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/router';
import { Navbar, Nav, Container, Button, Form, Badge, Card, Row, Col } from 'react-bootstrap';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { getPlayerHandicaps } from '../firebase';
import NavigationMenu from '../components/NavigationMenu';
import ScoreEntryModal from '../components/ScoreEntryModal';
import 'bootstrap/dist/css/bootstrap.min.css';
import Image from 'next/image';

const Results = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('live');
  const [liveMatches, setLiveMatches] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [leaderboards, setLeaderboards] = useState({});
  const [courseStats, setCourseStats] = useState({});
  const [strokePlayScores, setStrokePlayScores] = useState({});
  const [coursePerformance, setCoursePerformance] = useState({});
  const [players, setPlayers] = useState([]);
  const [startingHandicaps, setStartingHandicaps] = useState({});
  const [loading, setLoading] = useState(true);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const router = useRouter();

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
  }, [router]);

    useEffect(() => {
    const db = getFirestore();
    
    // Fetch players data
    const fetchPlayers = async () => {
      try {
        const playerList = await getPlayerHandicaps();
        console.log('Players loaded:', playerList);
        setPlayers(playerList);
      } catch (error) {
        console.error('Error fetching players:', error);
      }
    };
    fetchPlayers();
    
    // Listen for live matches (available to everyone)
    const liveMatchesRef = doc(db, 'liveMatches', '2025');
    const liveMatchesUnsubscribe = onSnapshot(liveMatchesRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const matches = Object.entries(data).map(([id, match]) => ({
          id,
          ...match
        }));
        console.log('Live matches loaded:', matches);
        setLiveMatches(matches);
      } else {
        setLiveMatches([]);
      }
    });

    // Listen for match history (available to everyone)
    const historyRef = doc(db, 'matchHistory', '2025');
    const historyUnsubscribe = onSnapshot(historyRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const history = Object.entries(data).map(([id, match]) => ({
          id,
          ...match
        }));
        setMatchHistory(history);
      } else {
        setMatchHistory([]);
      }
    });

    // Listen for leaderboards (available to everyone)
    const leaderboardsRef = doc(db, 'leaderboards', '2025');
    const leaderboardsUnsubscribe = onSnapshot(leaderboardsRef, (doc) => {
        if (doc.exists()) {
        setLeaderboards(doc.data());
      } else {
        setLeaderboards({});
        }
      });

          // Listen for course stats (available to everyone)
      const courseStatsRef = doc(db, 'courseStats', '2025');
      const courseStatsUnsubscribe = onSnapshot(courseStatsRef, (doc) => {
        if (doc.exists()) {
          setCourseStats(doc.data());
        } else {
          setCourseStats({});
        }
      });

      // Listen for stroke play scores (available to everyone)
      const strokePlayRef = doc(db, 'strokePlay', '2025');
      const strokePlayUnsubscribe = onSnapshot(strokePlayRef, (doc) => {
        if (doc.exists()) {
          setStrokePlayScores(doc.data());
        } else {
          setStrokePlayScores({});
        }
      });

      // Listen for course performance scores (available to everyone)
      const coursePerformanceRef = doc(db, 'coursePerformance', '2025');
      const coursePerformanceUnsubscribe = onSnapshot(coursePerformanceRef, (doc) => {
        if (doc.exists()) {
          setCoursePerformance(doc.data());
        } else {
          setCoursePerformance({});
        }
      });

      // Listen for starting handicaps (available to everyone)
      const startingHandicapsRef = doc(db, 'startingHandicaps', '2025');
      const startingHandicapsUnsubscribe = onSnapshot(startingHandicapsRef, (doc) => {
        if (doc.exists()) {
          setStartingHandicaps(doc.data());
        } else {
          setStartingHandicaps({});
        }
      });

      setLoading(false);

      return () => {
        liveMatchesUnsubscribe();
        historyUnsubscribe();
        leaderboardsUnsubscribe();
        courseStatsUnsubscribe();
        strokePlayUnsubscribe();
        coursePerformanceUnsubscribe();
        startingHandicapsUnsubscribe();
      };
  }, []);

  const formatMatchScore = (match) => {
    if (!match.currentScore) return 'Not Started';
    
    const { player1Score, player2Score, holesPlayed } = match.currentScore;
    const diff = player1Score - player2Score;
    
    if (diff === 0) return 'All Square';
    if (diff > 0) {
      // Player 1 is up
      if (match.matchType === 'alternating') {
        return `${match.soloPlayer} ${diff}UP`;
      } else {
        return `${match.player1} ${diff}UP`;
      }
    } else {
      // Player 2 is up
      if (match.matchType === 'alternating') {
        return `${match.team2Players?.join(' & ')} ${Math.abs(diff)}UP`;
      } else {
        return `${match.player2} ${Math.abs(diff)}UP`;
      }
    }
  };

  const getMatchStatus = (match) => {
    if (!match.status) return 'Not Started';
    if (match.status === 'completed') return 'Completed';
    if (match.status === 'in_progress') return 'In Progress';
    return match.status;
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'warning';
      case 'not_started': return 'secondary';
      default: return 'info';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const handleCompleteMatch = async (match) => {
    if (!confirm('Are you sure you want to complete this match?')) return;

    try {
      const db = getFirestore();
      const currentScore = match.currentScore || { player1Score: 0, player2Score: 0 };
      
      // Determine winner and final score
      const winner = currentScore.player1Score > currentScore.player2Score ? 
        (match.matchType === 'alternating' ? match.soloPlayer : match.player1) :
        (match.matchType === 'alternating' ? match.team2Players?.join(' & ') : match.player2);
      
      const loser = currentScore.player1Score > currentScore.player2Score ? 
        (match.matchType === 'alternating' ? match.team2Players?.join(' & ') : match.player2) :
        (match.matchType === 'alternating' ? match.soloPlayer : match.player1);
      
      const finalScore = currentScore.player1Score > currentScore.player2Score ? 
        `${currentScore.player1Score}&${currentScore.player2Score}` : 
        `${currentScore.player2Score}&${currentScore.player1Score}`;

      // Move to history
      await setDoc(doc(db, 'matchHistory', '2025'), {
        [match.id]: {
          courseName: match.courseName,
          date: match.date,
          teeTime: match.teeTime,
          player1: match.matchType === 'alternating' ? match.soloPlayer : match.player1,
          player2: match.matchType === 'alternating' ? match.team2Players?.join(' & ') : match.player2,
          winner: winner,
          loser: loser,
          finalScore: finalScore,
          duration: '4h 15m', // TODO: Calculate actual duration
          completedAt: new Date()
        }
      }, { merge: true });

      // Remove from live matches
      await setDoc(doc(db, 'liveMatches', '2025'), {
        [match.id]: null
      }, { merge: true });

      alert('Match completed successfully!');
    } catch (error) {
      console.error('Error completing match:', error);
      alert('Error completing match. Please try again.');
    }
  };

  const handleDeleteMatch = async (match) => {
    if (!confirm('Are you sure you want to delete this match? This action cannot be undone.')) return;
    
    try {
      const db = getFirestore();
      
      // Remove from live matches
      await setDoc(doc(db, 'liveMatches', '2025'), {
        [match.id]: null
      }, { merge: true });
      
      alert('Match deleted successfully!');
    } catch (error) {
      console.error('Error deleting match:', error);
      alert('Error deleting match. Please try again.');
    }
  };

  const LiveMatchesTab = () => (
    <div className="live-matches-section">
      <div className="section-header mb-4">
        <h2 className="text-3xl font-semibold text-success">Live Matches</h2>
        <p className="text-muted">Real-time updates from the course</p>
      </div>

      {liveMatches.length === 0 ? (
        <div className="no-matches text-center py-5">
          <div className="empty-state">
            <Image 
              src="/grass-texture.jpg" 
              alt="No matches" 
              width={200} 
              height={150}
              className="rounded opacity-50"
            />
            <h3 className="mt-3 text-muted">No Live Matches</h3>
            <p className="text-muted">Matches will appear here when they start</p>
          </div>
        </div>
      ) : (
        <Row>
          {liveMatches.map((match) => (
            <Col key={match.id} lg={6} md={12} className="mb-4">
              <Card className="match-card h-100">
                <Card.Header className="match-header">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">{match.courseName}</h5>
                    <Badge bg={getStatusBadgeVariant(match.status)}>
                      {getMatchStatus(match)}
                    </Badge>
                  </div>
                  <small className="text-muted">
                    {match.teeTime} • {match.date}
                  </small>
                </Card.Header>
                <Card.Body>
                                     <div className="match-players mb-3">
                     <div className="player-row d-flex justify-content-between align-items-center">
                       <div className="d-flex flex-column">
                         <span className="player-name">
                           {match.matchType === 'alternating' ? match.soloPlayer : match.player1}
                         </span>
                         <small className="text-muted">
                           {match.matchType === 'alternating' ? 
                             (match.soloPlayerTeam || 'Unknown Team') : 
                             (match.player1Team || 'Unknown Team')}
                         </small>
                       </div>
                       <span className="player-score">{match.currentScore?.player1Score || 0}</span>
                     </div>
                     <div className="player-row d-flex justify-content-between align-items-center">
                       <div className="d-flex flex-column">
                         <span className="player-name">
                           {match.matchType === 'alternating' ? match.team2Players?.join(' & ') : match.player2}
                         </span>
                         <small className="text-muted">
                           {match.matchType === 'alternating' ? 
                             (match.team2PlayerTeams?.join(' & ') || 'Unknown Team') : 
                             (match.player2Team || 'Unknown Team')}
                         </small>
                       </div>
                       <span className="player-score">{match.currentScore?.player2Score || 0}</span>
                     </div>
                   </div>
                  
                  <div className="match-score text-center mb-3">
                    <h4 className="text-success mb-1">{formatMatchScore(match)}</h4>
                    <small className="text-muted">
                      {match.currentScore?.holesPlayed || 0} holes played
                    </small>
                  </div>

                  {match.currentScore?.holesPlayed > 0 && (
                    <div className="hole-progress">
                      <small className="text-muted d-block mb-2">Recent Holes:</small>
                      <div className="d-flex flex-wrap gap-1">
                        {match.currentScore.recentHoles?.slice(-6).map((hole, idx) => (
                          <Badge 
                            key={idx} 
                            bg={hole.result === 'win' ? 'success' : hole.result === 'loss' ? 'danger' : 'secondary'}
                            className="hole-badge"
                          >
                            H{hole.number}: {hole.result}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="match-footer mt-3 pt-3 border-top">
                    <small className="text-muted">
                      Last updated: {formatTime(match.lastUpdate)}
                    </small>
                                         <div className="d-flex gap-2">
                       <Button 
                         variant="outline-success" 
                         size="sm"
                         onClick={() => {
                           setSelectedMatch(match);
                           setShowScoreModal(true);
                         }}
                       >
                         Update Score
                       </Button>
                       <Button 
                         variant="outline-warning" 
                         size="sm"
                         onClick={() => handleCompleteMatch(match)}
                       >
                         Complete Match
                       </Button>
                       <Button 
                         variant="outline-danger" 
                         size="sm"
                         onClick={() => handleDeleteMatch(match)}
                       >
                         Delete
                       </Button>
                     </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );

  const MatchHistoryTab = () => (
    <div className="match-history-section">
      <div className="section-header mb-4">
        <h2 className="text-3xl font-semibold text-success">Match History</h2>
        <p className="text-muted">Completed matches and results</p>
      </div>

      {matchHistory.length === 0 ? (
        <div className="no-history text-center py-5">
          <div className="empty-state">
            <Image 
              src="/grass-texture.jpg" 
              alt="No history" 
              width={200} 
              height={150}
              className="rounded opacity-50"
            />
            <h3 className="mt-3 text-muted">No Match History</h3>
            <p className="text-muted">Completed matches will appear here</p>
          </div>
        </div>
      ) : (
        <div className="history-list">
          {matchHistory.map((match) => (
            <Card key={match.id} className="history-card mb-3">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start">
                  <div className="match-info">
                    <h5 className="mb-1">{match.courseName}</h5>
                    <p className="text-muted mb-2">
                      {match.date} • {match.teeTime}
                    </p>
                    <div className="match-result">
                      <span className="winner">{match.winner}</span>
                      <span className="result-text"> def. </span>
                      <span className="loser">{match.loser}</span>
                      <Badge bg="success" className="ms-2">
                        {match.finalScore}
                      </Badge>
                    </div>
                  </div>
                  <div className="match-stats text-end">
                    <small className="text-muted d-block">Duration</small>
                    <span className="text-success">{match.duration}</span>
                  </div>
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const LeaderboardsTab = () => {
    // Process team points from leaderboards data
    const teamStandings = Object.entries(leaderboards)
      .filter(([key, data]) => data && typeof data === 'object' && data.points !== undefined)
      .map(([team, data]) => ({
        name: team,
        points: data.points || 0
      }))
      .sort((a, b) => b.points - a.points);

    // Process stroke play scores - calculate cumulative totals
    const playerCumulativeScores = {};
    
    Object.entries(strokePlayScores)
      .filter(([key, data]) => data && typeof data === 'object' && data.score !== undefined)
      .forEach(([key, data]) => {
        const player = data.player;
        if (!playerCumulativeScores[player]) {
          playerCumulativeScores[player] = {
            player: player,
            totalScore: 0,
            rounds: [],
            startingHandicap: 0
          };
        }
        playerCumulativeScores[player].totalScore += data.score;
        playerCumulativeScores[player].rounds.push({
          date: data.date,
          course: data.course || 'Unknown Course',
          score: data.score
        });
      });

    // Add starting handicaps to the calculation
    Object.entries(startingHandicaps).forEach(([player, handicap]) => {
      if (playerCumulativeScores[player]) {
        playerCumulativeScores[player].startingHandicap = handicap;
        playerCumulativeScores[player].totalScore += handicap;
      }
    });

    const strokePlayStandings = Object.values(playerCumulativeScores)
      .sort((a, b) => a.totalScore - b.totalScore); // Sort by best total score (lowest first)

    return (
      <div className="leaderboards-section">
        <div className="section-header mb-4">
          <h2 className="text-3xl font-semibold text-success">Leaderboards</h2>
          <p className="text-muted">Current standings and statistics</p>
        </div>

        <Row>
          <Col lg={6} md={12} className="mb-4">
            <Card className="leaderboard-card">
              <Card.Header>
                <h5 className="mb-0">Team Standings</h5>
              </Card.Header>
              <Card.Body>
                {teamStandings.length > 0 ? (
                  <div className="team-standings">
                    {teamStandings.map((team, idx) => (
                      <div key={team.name} className="team-row d-flex justify-content-between align-items-center py-2 border-bottom">
                        <div className="team-info">
                          <span className="team-name">
                            #{idx + 1} {team.name}
                          </span>
                          <small className="text-muted d-block">
                            {team.points} points
                          </small>
                        </div>
                        <div className="team-stats text-end">
                          <span className="text-success fw-bold">{team.points}</span>
                          <small className="text-muted d-block">points</small>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted text-center">No team standings available</p>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col lg={6} md={12} className="mb-4">
            <Card className="leaderboard-card">
              <Card.Header>
                <h5 className="mb-0">Stroke Play Leaders</h5>
              </Card.Header>
              <Card.Body>
                {strokePlayStandings.length > 0 ? (
                  <div className="individual-leaders">
                                         {strokePlayStandings.slice(0, 10).map((player, idx) => (
                       <div key={player.player} className="player-row d-flex justify-content-between align-items-center py-2 border-bottom">
                         <div className="player-info">
                           <span className="player-name">
                             #{idx + 1} {player.player}
                           </span>
                           <small className="text-muted d-block">
                             {player.rounds.length} rounds • Starting: {player.startingHandicap > 0 ? `+${player.startingHandicap}` : player.startingHandicap}
                           </small>
                         </div>
                         <div className="player-stats text-end">
                           <span className={`fw-bold ${player.totalScore <= 0 ? 'text-success' : 'text-danger'}`}>
                             {player.totalScore > 0 ? `+${player.totalScore}` : player.totalScore}
                           </span>
                           <small className="text-muted d-block">total score</small>
                         </div>
                       </div>
                     ))}
                  </div>
                ) : (
                  <p className="text-muted text-center">No stroke play scores available</p>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  const CoursePerformanceTab = () => {
    const [coursePerformance, setCoursePerformance] = useState({});

    // Process course performance data
    const coursePerformanceData = Object.entries(coursePerformance)
      .filter(([key, data]) => data && typeof data === 'object' && data.score !== undefined)
      .map(([key, data]) => ({
        player: data.player,
        course: data.course,
        date: data.date,
        score: data.score
      }));

    // Calculate overall player statistics
    const playerStats = {};
    coursePerformanceData.forEach(score => {
      if (!playerStats[score.player]) {
        playerStats[score.player] = {
          totalRounds: 0,
          totalScore: 0,
          bestScore: null,
          courses: new Set()
        };
      }
      playerStats[score.player].totalRounds++;
      playerStats[score.player].totalScore += score.score;
      playerStats[score.player].courses.add(score.course);
      if (playerStats[score.player].bestScore === null || score.score < playerStats[score.player].bestScore) {
        playerStats[score.player].bestScore = score.score;
      }
    });

    // Calculate course statistics
    const courseStats = {};
    coursePerformanceData.forEach(score => {
      if (!courseStats[score.course]) {
        courseStats[score.course] = {
          totalRounds: 0,
          totalScore: 0,
          bestScore: null,
          players: new Set()
        };
      }
      courseStats[score.course].totalRounds++;
      courseStats[score.course].totalScore += score.score;
      courseStats[score.course].players.add(score.player);
      if (courseStats[score.course].bestScore === null || score.score < courseStats[score.course].bestScore) {
        courseStats[score.course].bestScore = score.score;
      }
    });

    // Convert to arrays and sort
    const playerStandings = Object.entries(playerStats)
      .map(([player, stats]) => ({
        player,
        avgScore: stats.totalRounds > 0 ? (stats.totalScore / stats.totalRounds).toFixed(1) : 0,
        totalRounds: stats.totalRounds,
        bestScore: stats.bestScore,
        coursesPlayed: stats.courses.size
      }))
      .sort((a, b) => parseFloat(a.avgScore) - parseFloat(b.avgScore));

    const courseStandings = Object.entries(courseStats)
      .map(([course, stats]) => ({
        course,
        avgScore: stats.totalRounds > 0 ? (stats.totalScore / stats.totalRounds).toFixed(1) : 0,
        totalRounds: stats.totalRounds,
        bestScore: stats.bestScore,
        uniquePlayers: stats.players.size
      }))
      .sort((a, b) => parseFloat(a.avgScore) - parseFloat(b.avgScore));

    return (
      <div className="course-performance-section">
        <div className="section-header mb-4">
          <h2 className="text-3xl font-semibold text-success">Course Performance</h2>
          <p className="text-muted">Track individual scores by course and overall statistics</p>
        </div>

        <Row>
          {/* Player Standings */}
          <Col lg={6} md={12} className="mb-4">
            <Card className="leaderboard-card">
              <Card.Header>
                <h5 className="mb-0">Player Standings</h5>
              </Card.Header>
              <Card.Body>
                {playerStandings.length > 0 ? (
                  <div className="player-standings">
                    {playerStandings.map((player, idx) => (
                      <div key={player.player} className="player-row d-flex justify-content-between align-items-center py-2 border-bottom">
                        <div className="player-info">
                          <span className="player-name">
                            #{idx + 1} {player.player}
                          </span>
                          <small className="text-muted d-block">
                            {player.totalRounds} rounds • {player.coursesPlayed} courses
                          </small>
                        </div>
                        <div className="player-stats text-end">
                          <span className={`fw-bold ${parseFloat(player.avgScore) <= 0 ? 'text-success' : 'text-danger'}`}>
                            {parseFloat(player.avgScore) > 0 ? `+${player.avgScore}` : player.avgScore}
                          </span>
                          <small className="text-muted d-block">avg score</small>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted text-center">No player data available</p>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* Course Statistics */}
          <Col lg={6} md={12} className="mb-4">
            <Card className="leaderboard-card">
              <Card.Header>
                <h5 className="mb-0">Course Statistics</h5>
              </Card.Header>
              <Card.Body>
                {courseStandings.length > 0 ? (
                  <div className="course-standings">
                    {courseStandings.map((course, idx) => (
                      <div key={course.course} className="course-row d-flex justify-content-between align-items-center py-2 border-bottom">
                        <div className="course-info">
                          <span className="course-name">
                            #{idx + 1} {course.course}
                          </span>
                          <small className="text-muted d-block">
                            {course.totalRounds} rounds • {course.uniquePlayers} players
                          </small>
                        </div>
                        <div className="course-stats text-end">
                          <span className={`fw-bold ${parseFloat(course.avgScore) <= 0 ? 'text-success' : 'text-danger'}`}>
                            {parseFloat(course.avgScore) > 0 ? `+${course.avgScore}` : course.avgScore}
                          </span>
                          <small className="text-muted d-block">avg score</small>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted text-center">No course data available</p>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  const PointsManagementTab = () => {
    const [teamPoints, setTeamPoints] = useState({
      goldenBoys: 0,
      puttPirates: 0
    });
    const [strokePlayScores, setStrokePlayScores] = useState({});
    const [newStrokeScore, setNewStrokeScore] = useState({
      player: '',
      date: '',
      score: '',
      course: ''
    });
    const [newStartingHandicap, setNewStartingHandicap] = useState({
      player: '',
      handicap: ''
    });

    const handleUpdateTeamPoints = async (team, points) => {
      try {
        const db = getFirestore();
        await setDoc(doc(db, 'leaderboards', '2025'), {
          [team]: { points: parseInt(points) }
        }, { merge: true });
        alert(`${team} points updated successfully!`);
      } catch (error) {
        console.error('Error updating team points:', error);
        alert('Error updating team points. Please try again.');
      }
    };

    const handleAddStrokeScore = async () => {
      if (!newStrokeScore.player || !newStrokeScore.date || !newStrokeScore.score || !newStrokeScore.course) {
        alert('Please fill in all fields');
        return;
      }

      try {
        const db = getFirestore();
        const scoreKey = `${newStrokeScore.date}-${newStrokeScore.player}`;
        const courseScoreKey = `${newStrokeScore.date}-${newStrokeScore.player}-${newStrokeScore.course}`;
        
        // Save to stroke play collection
        await setDoc(doc(db, 'strokePlay', '2025'), {
          [scoreKey]: {
            player: newStrokeScore.player,
            date: newStrokeScore.date,
            score: parseInt(newStrokeScore.score),
            course: newStrokeScore.course,
            submittedAt: new Date()
          }
        }, { merge: true });

        // Save to course performance collection
        await setDoc(doc(db, 'coursePerformance', '2025'), {
          [courseScoreKey]: {
            player: newStrokeScore.player,
            course: newStrokeScore.course,
            date: newStrokeScore.date,
            score: parseInt(newStrokeScore.score),
            submittedAt: new Date()
          }
        }, { merge: true });
        
        setNewStrokeScore({ player: '', date: '', score: '', course: '' });
        alert('Stroke play score added successfully!');
      } catch (error) {
        console.error('Error adding stroke play score:', error);
        alert('Error adding stroke play score. Please try again.');
      }
    };

    const handleAddStartingHandicap = async () => {
      if (!newStartingHandicap.player || !newStartingHandicap.handicap) {
        alert('Please fill in all fields');
        return;
      }

      try {
        const db = getFirestore();
        await setDoc(doc(db, 'startingHandicaps', '2025'), {
          [newStartingHandicap.player]: parseInt(newStartingHandicap.handicap)
        }, { merge: true });
        
        setNewStartingHandicap({ player: '', handicap: '' });
        alert('Starting handicap added successfully!');
      } catch (error) {
        console.error('Error adding starting handicap:', error);
        alert('Error adding starting handicap. Please try again.');
      }
    };

    const handleDeleteStrokeScore = async (scoreKey) => {
      if (!confirm('Are you sure you want to delete this score?')) return;
      
      try {
        const db = getFirestore();
        const [date, player] = scoreKey.split('-');
        
        // Remove from stroke play collection
        await setDoc(doc(db, 'strokePlay', '2025'), {
          [scoreKey]: null
        }, { merge: true });

        // Remove from course performance collection
        const courseScoreKey = `${date}-${player}-${strokePlayScores[scoreKey]?.course || 'Unknown'}`;
        await setDoc(doc(db, 'coursePerformance', '2025'), {
          [courseScoreKey]: null
        }, { merge: true });
        
        alert('Score deleted successfully!');
      } catch (error) {
        console.error('Error deleting score:', error);
        alert('Error deleting score. Please try again.');
      }
    };

    const handleDeleteStartingHandicap = async (player) => {
      if (!confirm(`Are you sure you want to delete the starting handicap for ${player}?`)) return;
      
      try {
        const db = getFirestore();
        await setDoc(doc(db, 'startingHandicaps', '2025'), {
          [player]: null
        }, { merge: true });
        
        alert('Starting handicap deleted successfully!');
      } catch (error) {
        console.error('Error deleting starting handicap:', error);
        alert('Error deleting starting handicap. Please try again.');
      }
    };

    return (
      <div className="points-management-section">
        <div className="section-header mb-4">
          <h2 className="text-3xl font-semibold text-success">Points Management</h2>
          <p className="text-muted">Update team points and individual stroke play scores</p>
        </div>

        <Row>
          {/* Team Points Management */}
          <Col lg={6} md={12} className="mb-4">
            <Card className="h-100">
              <Card.Header>
                <h5 className="mb-0">Team Points</h5>
              </Card.Header>
              <Card.Body>
                <div className="mb-3">
                  <label className="form-label">Golden Boys Points</label>
                  <div className="d-flex gap-2">
                    <Form.Control
                      type="number"
                      value={teamPoints.goldenBoys}
                      onChange={(e) => setTeamPoints(prev => ({ ...prev, goldenBoys: e.target.value }))}
                      placeholder="0"
                    />
                    <Button 
                      variant="success" 
                      size="sm"
                      onClick={() => handleUpdateTeamPoints('Golden Boys', teamPoints.goldenBoys)}
                    >
                      Update
                    </Button>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Putt Pirates Points</label>
                  <div className="d-flex gap-2">
                    <Form.Control
                      type="number"
                      value={teamPoints.puttPirates}
                      onChange={(e) => setTeamPoints(prev => ({ ...prev, puttPirates: e.target.value }))}
                      placeholder="0"
                    />
                    <Button 
                      variant="success" 
                      size="sm"
                      onClick={() => handleUpdateTeamPoints('Putt Pirates', teamPoints.puttPirates)}
                    >
                      Update
                    </Button>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Stroke Play Management */}
          <Col lg={6} md={12} className="mb-4">
            <Card className="h-100">
              <Card.Header>
                <h5 className="mb-0">Stroke Play Scores</h5>
              </Card.Header>
              <Card.Body>
                <div className="mb-3">
                  <label className="form-label">Player Name</label>
                  <Form.Select
                    value={newStrokeScore.player}
                    onChange={(e) => setNewStrokeScore(prev => ({ ...prev, player: e.target.value }))}
                  >
                    <option value="">-- Choose a Player --</option>
                    {players.length > 0 ? (
                      players.sort((a, b) => a.name.localeCompare(b.name)).map((player) => (
                        <option key={player.id} value={player.name}>{player.name}</option>
                      ))
                    ) : (
                      <option value="" disabled>Loading players...</option>
                    )}
                  </Form.Select>
                  {players.length === 0 && (
                    <small className="text-muted">No players found. Check console for debugging info.</small>
                  )}
                </div>
                <div className="mb-3">
                  <label className="form-label">Course</label>
                  <Form.Control
                    type="text"
                    value={newStrokeScore.course}
                    onChange={(e) => setNewStrokeScore(prev => ({ ...prev, course: e.target.value }))}
                    placeholder="Course name"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Date</label>
                  <Form.Control
                    type="date"
                    value={newStrokeScore.date}
                    onChange={(e) => setNewStrokeScore(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Score (+/-)</label>
                  <Form.Control
                    type="number"
                    value={newStrokeScore.score}
                    onChange={(e) => setNewStrokeScore(prev => ({ ...prev, score: e.target.value }))}
                    placeholder="+5, -2, etc."
                  />
                </div>
                <Button 
                  variant="success" 
                  className="w-100"
                  onClick={handleAddStrokeScore}
                >
                  Add Stroke Play Score
                </Button>
              </Card.Body>
            </Card>
          </Col>

          {/* Starting Handicap Management */}
          <Col lg={6} md={12} className="mb-4">
            <Card className="h-100">
              <Card.Header>
                <h5 className="mb-0">Starting Handicaps</h5>
              </Card.Header>
              <Card.Body>
                <div className="mb-3">
                  <label className="form-label">Player Name</label>
                  <Form.Select
                    value={newStartingHandicap.player}
                    onChange={(e) => setNewStartingHandicap(prev => ({ ...prev, player: e.target.value }))}
                  >
                    <option value="">-- Choose a Player --</option>
                    {players.length > 0 ? (
                      players.sort((a, b) => a.name.localeCompare(b.name)).map((player) => (
                        <option key={player.id} value={player.name}>{player.name}</option>
                      ))
                    ) : (
                      <option value="" disabled>Loading players...</option>
                    )}
                  </Form.Select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Starting Handicap (+/-)</label>
                  <Form.Control
                    type="number"
                    value={newStartingHandicap.handicap}
                    onChange={(e) => setNewStartingHandicap(prev => ({ ...prev, handicap: e.target.value }))}
                    placeholder="+5, -2, etc."
                  />
                </div>
                <Button 
                  variant="success" 
                  className="w-100"
                  onClick={handleAddStartingHandicap}
                >
                  Set Starting Handicap
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Existing Data Management */}
        <Row className="mt-4">
          <Col lg={6} md={12} className="mb-4">
            <Card>
              <Card.Header>
                <h5 className="mb-0">Existing Stroke Play Scores</h5>
              </Card.Header>
              <Card.Body>
                {Object.entries(strokePlayScores).length > 0 ? (
                  <div className="existing-scores">
                    {Object.entries(strokePlayScores)
                      .filter(([key, data]) => data && typeof data === 'object' && data.score !== undefined)
                      .map(([key, data]) => (
                        <div key={key} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                          <div>
                            <strong>{data.player}</strong>
                            <br />
                            <small className="text-muted">
                              {data.date} • {data.course || 'Unknown Course'} • {data.score > 0 ? `+${data.score}` : data.score}
                            </small>
                          </div>
                          <Button 
                            variant="outline-danger" 
                            size="sm"
                            onClick={() => handleDeleteStrokeScore(key)}
                          >
                            Delete
                          </Button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-muted text-center">No stroke play scores found</p>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col lg={6} md={12} className="mb-4">
            <Card>
              <Card.Header>
                <h5 className="mb-0">Existing Starting Handicaps</h5>
              </Card.Header>
              <Card.Body>
                {Object.entries(startingHandicaps).length > 0 ? (
                  <div className="existing-handicaps">
                    {Object.entries(startingHandicaps)
                      .filter(([player, handicap]) => handicap !== null && handicap !== undefined)
                      .map(([player, handicap]) => (
                        <div key={player} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                          <div>
                            <strong>{player}</strong>
                            <br />
                            <small className="text-muted">
                              Starting: {handicap > 0 ? `+${handicap}` : handicap}
                            </small>
                          </div>
                          <Button 
                            variant="outline-danger" 
                            size="sm"
                            onClick={() => handleDeleteStartingHandicap(player)}
                          >
                            Delete
                          </Button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-muted text-center">No starting handicaps found</p>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  return (
    <div className="app-wrapper">
      {authenticated && <NavigationMenu />}
      <div className="home-container">
        <div className="overlay"></div>
        <div className="content">
          <h1 className="text-4xl font-semibold mb-8 cursive-font text-center">Match Results</h1>
          
          {/* Navigation Tabs */}
          <div className="results-navigation mb-4">
            <div className="nav-tabs-container">
              <Button
                variant={activeTab === 'live' ? 'success' : 'outline-success'}
                className="nav-tab"
                onClick={() => setActiveTab('live')}
              >
                Active Matches
              </Button>
              <Button
                variant={activeTab === 'history' ? 'success' : 'outline-success'}
                className="nav-tab"
                onClick={() => setActiveTab('history')}
              >
                Match History
              </Button>
              <Button
                variant={activeTab === 'leaderboards' ? 'success' : 'outline-success'}
                className="nav-tab"
                onClick={() => setActiveTab('leaderboards')}
              >
                Leaderboards
              </Button>
                          <Button 
                variant={activeTab === 'performance' ? 'success' : 'outline-success'}
                className="nav-tab"
                onClick={() => setActiveTab('performance')}
              >
                Course Performance
              </Button>
              <Button 
                variant={activeTab === 'management' ? 'success' : 'outline-success'}
                className="nav-tab"
                onClick={() => setActiveTab('management')}
              >
                Points Management
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-5">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          )}

          {/* Content Tabs */}
          {!loading && (
                      <div className="results-content">
              {activeTab === 'live' && <LiveMatchesTab />}
              {activeTab === 'history' && <MatchHistoryTab />}
              {activeTab === 'leaderboards' && <LeaderboardsTab />}
              {activeTab === 'performance' && <CoursePerformanceTab />}
              {activeTab === 'management' && <PointsManagementTab />}
            </div>
          )}
        </div>
      </div>
      
      {/* Score Entry Modal */}
      <ScoreEntryModal
        show={showScoreModal}
        onHide={() => setShowScoreModal(false)}
        match={selectedMatch}
        onSave={(updatedMatch) => {
          // Update local state if needed
          console.log('Match updated:', updatedMatch);
        }}
      />
    </div>
  );
};

export default Results;