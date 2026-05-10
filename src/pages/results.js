import { useState, useEffect, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Navbar, Nav, Container, Button, Form, Badge, Card, Row, Col } from 'react-bootstrap';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, query, orderBy, deleteField, getDoc } from 'firebase/firestore';
import { getPlayerHandicaps, getPlayers } from '../firebase';
import NavigationMenu from '../components/NavigationMenu';
import FloatingNavigation from '../components/FloatingNavigation';
import ScoreEntryModal from '../components/ScoreEntryModal';

import Image from 'next/image';

// --- Utility Functions ---

const formatMatchScore = (match) => {
  if (!match.currentScore) return 'Not Started';
  
  if (match.matchType === 'championship') {
    const { team1Wins, team2Wins, holesPlayed } = match.currentScore;
    const diff = team1Wins - team2Wins;
    
    if (diff === 0) return 'All Square';
    if (diff > 0) {
      return `${match.team1?.name || 'Putt Pirates'} ${diff}UP`;
    } else {
      return `${match.team2?.name || 'Golden Boys'} ${Math.abs(diff)}UP`;
    }
  } else {
    const { player1Score, player2Score, holesPlayed } = match.currentScore;
    const diff = player1Score - player2Score;
    
    if (diff === 0) return 'All Square';
    if (diff > 0) {
      if (match.matchType === 'alternating') {
        return `${typeof match.soloPlayer === 'string' ? match.soloPlayer : (match.soloPlayer?.name || 'Unknown')} ${diff}UP`;
      } else if (match.matchType === '2v2') {
        return `${match.team1?.join(' & ') || 'Putt Pirates'} ${diff}UP`;
      } else {
        return `${typeof match.player1 === 'string' ? match.player1 : (match.player1?.name || 'Unknown')} ${diff}UP`;
      }
    } else {
      if (match.matchType === 'alternating') {
        return `${match.team2Players?.map(p => typeof p === 'string' ? p : p.name).join(' & ')} ${Math.abs(diff)}UP`;
      } else if (match.matchType === '2v2') {
        return `${match.team2?.join(' & ') || 'Golden Boys'} ${Math.abs(diff)}UP`;
      } else {
        return `${typeof match.player2 === 'string' ? match.player2 : (match.player2?.name || 'Unknown')} ${Math.abs(diff)}UP`;
      }
    }
  }
};

const getMatchStatus = (match) => {
  if (!match.status || match.status === 'not_started') return 'Not Started';
  if (match.status === 'completed') return 'Completed';
  if (match.status === 'in_progress') return 'In Progress';
  return match.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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

const formatTeeTime = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

const formatHoleResult = (match, hole) => {
  if (!hole || !hole.result) return 'Tie';
  if (match.matchType === 'championship') {
    if (hole.result === 'team1_win') return `${match.team1?.name || 'Putt Pirates'} wins`;
    if (hole.result === 'team2_win') return `${match.team2?.name || 'Golden Boys'} wins`;
    return 'Tie';
  } else if (match.matchType === 'alternating') {
    if (hole.result === 'player1_win') return `${typeof match.soloPlayer === 'string' ? match.soloPlayer : match.soloPlayer?.name} wins`;
    if (hole.result === 'player2_win') return `${match.team2Players?.map(p => typeof p === 'string' ? p : p.name).join(' & ')} wins`;
    return 'Tie';
  } else if (match.matchType === '2v2') {
    if (hole.result === 'player1_win') return `${match.team1?.join(' & ') || 'Putt Pirates'} wins`;
    if (hole.result === 'player2_win') return `${match.team2?.join(' & ') || 'Golden Boys'} wins`;
    return 'Tie';
  } else {
    if (hole.result === 'player1_win') return `${typeof match.player1 === 'string' ? match.player1 : match.player1?.name} wins`;
    if (hole.result === 'player2_win') return `${typeof match.player2 === 'string' ? match.player2 : match.player2?.name} wins`;
    return 'Tie';
  }
};

// --- Tab Components ---

const LiveMatchesTab = ({ 
  liveMatches, 
  sortedLiveMatches, 
  setSelectedMatch, 
  setShowScoreModal, 
  handleCompleteMatch, 
  handleDeleteMatch,
  confirmingId,
  setConfirmingId 
}) => (
  <div className="live-matches-section">
    <div className="section-header mb-4">
      <h2 className="text-3xl font-semibold text-success">Live Matches</h2>
      <p className="text-muted">Real-time updates from the course</p>
    </div>

    {sortedLiveMatches.length === 0 ? (
      <div className="no-matches text-center py-5">
        <div className="empty-state">
          <Image src="/grass-texture.jpg" alt="No matches" width={200} height={150} className="rounded opacity-50" />
          <h3 className="mt-3 text-muted">No Live Matches</h3>
          <p className="text-muted">Matches will appear here when they start</p>
        </div>
      </div>
    ) : (
      <Row>
        {sortedLiveMatches.map((match) => (
          <Col key={match.id} lg={6} md={12} className="mb-4">
            <Card className="match-card h-100">
              <Card.Header className="match-header">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    {match.courseName}
                    {match.matchType === '2v2' && <Badge bg="info" className="ms-2">{match.format || '2v2'}</Badge>}
                  </h5>
                  <Badge bg={getStatusBadgeVariant(match.status)}>{getMatchStatus(match)}</Badge>
                </div>
                <small className="text-muted">{formatTeeTime(match.teeTime)} • {match.date}</small>
              </Card.Header>
              <Card.Body>
                <div className="match-players mb-3">
                  {match.matchType === 'championship' ? (
                    <div>
                      <div className="player-row d-flex justify-content-between align-items-center">
                        <div className="d-flex flex-column">
                          <span className="player-name">{match.team1?.name || 'Putt Pirates'}</span>
                          <small className="text-muted">{match.team1?.players?.map(p => typeof p === 'string' ? p : p.name).join(', ') || 'No players assigned'}</small>
                        </div>
                        <span className="player-score">{match.currentScore?.team1Wins || 0}</span>
                      </div>
                      <div className="player-row d-flex justify-content-between align-items-center">
                        <div className="d-flex flex-column">
                          <span className="player-name">{match.team2?.name || 'Golden Boys'}</span>
                          <small className="text-muted">{match.team2?.players?.map(p => typeof p === 'string' ? p : p.name).join(', ') || 'No players assigned'}</small>
                        </div>
                        <span className="player-score">{match.currentScore?.team2Wins || 0}</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="player-row d-flex justify-content-between align-items-center">
                        <div className="d-flex flex-column">
                          <span className="player-name">
                            {match.matchType === 'alternating' ? (typeof match.soloPlayer === 'string' ? match.soloPlayer : (match.soloPlayer?.name || 'Unknown')) : match.matchType === '2v2' ? (match.team1?.join(' & ') || 'Putt Pirates') : (typeof match.player1 === 'string' ? match.player1 : (match.player1?.name || 'Unknown'))}
                          </span>
                          <small className="text-muted">
                            {match.matchType === 'alternating' ? (match.soloPlayerTeam || 'Unknown') : match.matchType === '2v2' ? 'Putt Pirates' : (match.player1Team || 'Unknown')}
                          </small>
                        </div>
                        <span className="player-score">{match.currentScore?.player1Score || 0}</span>
                      </div>
                      <div className="player-row d-flex justify-content-between align-items-center">
                        <div className="d-flex flex-column">
                          <span className="player-name">
                            {match.matchType === 'alternating' ? match.team2Players?.map(p => typeof p === 'string' ? p : p.name).join(' & ') : match.matchType === '2v2' ? (match.team2?.join(' & ') || 'Golden Boys') : (typeof match.player2 === 'string' ? match.player2 : (match.player2?.name || 'Unknown'))}
                          </span>
                          <small className="text-muted">
                            {match.matchType === 'alternating' ? (match.team2PlayerTeams?.join(' & ') || 'Unknown') : match.matchType === '2v2' ? 'Golden Boys' : (match.player2Team || 'Unknown')}
                          </small>
                        </div>
                        <span className="player-score">{match.currentScore?.player2Score || 0}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="match-score text-center mb-3">
                  <h4 className="text-success mb-1">{formatMatchScore(match)}</h4>
                  <small className="text-muted">{match.currentScore?.holesPlayed || 0} holes played</small>
                </div>
                {match.currentScore?.holesPlayed > 0 && (
                  <div className="hole-progress">
                    <small className="text-muted d-block mb-2">Recent Holes:</small>
                    <div className="d-flex flex-wrap gap-1">
                      {match.currentScore.recentHoles?.slice(-6).map((hole, idx) => (
                        <Badge key={idx} bg={hole.result === 'player1_win' || hole.result === 'team1_win' ? 'putt-pirates' : hole.result === 'player2_win' || hole.result === 'team2_win' ? 'golden-boys' : 'secondary'} className="hole-badge text-white">
                          H{hole.number}: {formatHoleResult(match, hole)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="match-footer mt-3 pt-3 border-top d-flex justify-content-between align-items-center">
                  <small className="text-muted">{match.lastUpdate ? `Last updated: ${formatTime(match.lastUpdate)}` : 'Match not started yet'}</small>
                  <div className="d-flex gap-2">
                    {confirmingId === `${match.id}-delete` ? (
                      <div className="d-flex gap-1">
                        <Button variant="danger" size="sm" onClick={() => handleDeleteMatch(match)}>Confirm Delete</Button>
                        <Button variant="secondary" size="sm" onClick={() => setConfirmingId(null)}>Cancel</Button>
                      </div>
                    ) : confirmingId === `${match.id}-complete` ? (
                      <div className="d-flex gap-1">
                        <Button variant="warning" size="sm" onClick={() => handleCompleteMatch(match)}>Confirm Complete</Button>
                        <Button variant="secondary" size="sm" onClick={() => setConfirmingId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <>
                        <Button variant="outline-success" size="sm" onClick={() => { setSelectedMatch(match); setShowScoreModal(true); }}>Update</Button>
                        <Button variant="outline-warning" size="sm" onClick={() => setConfirmingId(`${match.id}-complete`)}>Complete</Button>
                        <Button variant="outline-danger" size="sm" onClick={() => setConfirmingId(`${match.id}-delete`)}>Delete</Button>
                      </>
                    )}
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

const LeaderboardsTab = ({ teamStandings, strokePlayStandings }) => (
  <div className="leaderboards-section">
    <div className="section-header mb-4">
      <h2 className="text-3xl font-semibold text-success">Leaderboards</h2>
      <p className="text-muted">Current standings and statistics</p>
    </div>
    <Row>
      <Col lg={6} md={12} className="mb-4">
        <Card className="leaderboard-card">
          <Card.Header><h5 className="mb-0">Team Standings</h5></Card.Header>
          <Card.Body>
            {teamStandings.length > 0 ? (
              <div className="team-standings">
                {teamStandings.map((team, idx) => (
                  <div key={team.name} className="team-row d-flex justify-content-between align-items-center py-2 border-bottom">
                    <div className="team-info">
                      <span className="team-name">#{idx + 1} {team.name}</span>
                      <small className="text-muted d-block">{team.points} points</small>
                    </div>
                    <div className="team-stats text-end">
                      <span className="text-success fw-bold">{team.points}</span>
                      <small className="text-muted d-block">points</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-muted text-center">No team standings available</p>}
          </Card.Body>
        </Card>
      </Col>
      <Col lg={6} md={12} className="mb-4">
        <Card className="leaderboard-card">
          <Card.Header><h5 className="mb-0">Stroke Play Leaders</h5></Card.Header>
          <Card.Body>
            {strokePlayStandings.length > 0 ? (
              <div className="individual-leaders">
                {strokePlayStandings.slice(0, 10).map((player, idx) => (
                  <div key={player.player} className="player-row d-flex justify-content-between align-items-center py-2 border-bottom">
                    <div className="player-info">
                      <span className="player-name">#{idx + 1} {player.player}</span>
                      <small className="text-muted d-block">{player.rounds.length} rounds</small>
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
            ) : <p className="text-muted text-center">No stroke play scores available</p>}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  </div>
);

const PointsManagementTab = ({ 
  players, 
  sortedPlayers, 
  existingStrokeScores, 
  teamPoints, 
  setTeamPoints, 
  updateMessage, 
  newStrokeScore, 
  setNewStrokeScore, 
  handleUpdateTeamPoints, 
  handleAddStrokeScore, 
  handleDeleteStrokeScore,
  confirmingId,
  setConfirmingId 
}) => (
  <div className="points-management-section">
    <div className="section-header mb-4">
      <h2 className="text-3xl font-semibold text-success">Points Management</h2>
      <p className="text-muted">Update team points and individual stroke play scores</p>
    </div>
    
    {updateMessage && (
      <div className="alert alert-success py-2 mb-4 text-center sticky-top shadow-sm" style={{ top: '20px', zIndex: 1000 }}>
        {updateMessage}
      </div>
    )}

    <Row>
      <Col lg={6} md={12} className="mb-4">
        <Card className="h-100">
          <Card.Header><h5 className="mb-0">Team Points</h5></Card.Header>
          <Card.Body>
            <div className="mb-3">
              <label className="form-label">Golden Boys Points</label>
              <div className="d-flex gap-2">
                <Form.Control type="number" value={teamPoints.goldenBoys} onChange={(e) => setTeamPoints(prev => ({ ...prev, goldenBoys: e.target.value }))} />
                <Button variant="success" size="sm" onClick={() => handleUpdateTeamPoints('Golden Boys', teamPoints.goldenBoys)}>Update</Button>
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Putt Pirates Points</label>
              <div className="d-flex gap-2">
                <Form.Control type="number" value={teamPoints.puttPirates} onChange={(e) => setTeamPoints(prev => ({ ...prev, puttPirates: e.target.value }))} />
                <Button variant="success" size="sm" onClick={() => handleUpdateTeamPoints('Putt Pirates', teamPoints.puttPirates)}>Update</Button>
              </div>
            </div>
          </Card.Body>
        </Card>
      </Col>
      <Col lg={6} md={12} className="mb-4">
        <Card className="h-100">
          <Card.Header><h5 className="mb-0">Add Stroke Play Score</h5></Card.Header>
          <Card.Body>
            <div className="mb-3">
              <label className="form-label">Player Name</label>
              <Form.Select value={newStrokeScore.player} onChange={(e) => setNewStrokeScore(prev => ({ ...prev, player: e.target.value }))}>
                <option value="">-- Choose a Player --</option>
                {sortedPlayers.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </Form.Select>
            </div>
            <div className="mb-3">
              <label className="form-label">Date</label>
              <Form.Control type="date" value={newStrokeScore.date} onChange={(e) => setNewStrokeScore(prev => ({ ...prev, date: e.target.value }))} />
            </div>
            <div className="mb-3">
              <label className="form-label">Score (+/-)</label>
              <Form.Control type="number" value={newStrokeScore.score} onChange={(e) => setNewStrokeScore(prev => ({ ...prev, score: e.target.value }))} placeholder="+5, -2, etc." />
            </div>
            <Button variant="success" className="w-100" onClick={handleAddStrokeScore}>Add Score</Button>
          </Card.Body>
        </Card>
      </Col>
    </Row>
    <Row className="mt-4">
      <Col lg={12} className="mb-4">
        <Card>
          <Card.Header><h5 className="mb-0">Existing Stroke Play Scores</h5></Card.Header>
          <Card.Body>
            {existingStrokeScores.length > 0 ? (
              <div className="existing-scores row">
                {existingStrokeScores.map(([key, data]) => (
                  <div key={key} className="col-md-6 col-lg-4 mb-2">
                    <div className="d-flex justify-content-between align-items-center p-2 border rounded">
                      <div>
                        <strong>{data.player}</strong> <small className="text-muted">({data.date})</small>
                        <div className="text-success fw-bold">{data.score > 0 ? `+${data.score}` : data.score}</div>
                      </div>
                      {confirmingId === key ? (
                        <div className="d-flex gap-1">
                          <Button variant="danger" size="sm" onClick={() => handleDeleteStrokeScore(key)}>Confirm</Button>
                          <Button variant="secondary" size="sm" onClick={() => setConfirmingId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button variant="outline-danger" size="sm" onClick={() => setConfirmingId(key)}>×</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-muted text-center">No scores found</p>}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  </div>
);

const MatchHistoryTab = ({ matchHistory }) => (
  <div className="match-history-section">
    <div className="section-header mb-4">
      <h2 className="text-3xl font-semibold text-success">Match History</h2>
      <p className="text-muted">Completed matches and final results</p>
    </div>
    {matchHistory.length === 0 ? <p className="text-center py-5 text-muted">No completed matches found</p> : (
      <div className="history-list">
        {matchHistory.map((match) => (
          <Card key={match.id} className="mb-3 border-start-success shadow-sm">
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="mb-1 text-success">{match.courseName}</h6>
                  <div className="fw-bold">{formatMatchScore(match)}</div>
                  <small className="text-muted">{match.date} • {formatTeeTime(match.teeTime)}</small>
                </div>
                <div className="text-end">
                  <Badge bg="success" className="mb-1">Final</Badge>
                  <small className="text-muted d-block">{match.currentScore?.holesPlayed || 18} holes</small>
                </div>
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>
    )}
  </div>
);

// --- Main Component ---

const Results = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('live');
  const [liveMatches, setLiveMatches] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [leaderboards, setLeaderboards] = useState({});
  const [courseStats, setCourseStats] = useState({});
  const [strokePlayScores, setStrokePlayScores] = useState({});
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  
  const [updateMessage, setUpdateMessage] = useState('');
  const [teamPoints, setTeamPoints] = useState({ goldenBoys: 0, puttPirates: 0 });
  const [newStrokeScore, setNewStrokeScore] = useState({ player: '', date: '', score: '' });
  const [confirmingId, setConfirmingId] = useState(null);

  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setAuthenticated(true);
      else router.push('/');
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (authenticated) {
      const db = getFirestore();
      
      const liveUnsubscribe = onSnapshot(doc(db, 'liveMatches', '2025'), (doc) => {
        if (doc.exists()) setLiveMatches(Object.entries(doc.data()).map(([id, data]) => ({ id, ...data })));
        setLoading(false);
      });

      const historyUnsubscribe = onSnapshot(doc(db, 'matchHistory', '2025'), (doc) => {
        if (doc.exists()) setMatchHistory(Object.entries(doc.data()).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.completedAt?.toMillis() - a.completedAt?.toMillis()));
      });

      const leaderboardUnsubscribe = onSnapshot(doc(db, 'leaderboards', '2025'), (doc) => {
        if (doc.exists()) setLeaderboards(doc.data());
      });

      const strokePlayUnsubscribe = onSnapshot(doc(db, 'strokePlay', '2025'), (doc) => {
        if (doc.exists()) setStrokePlayScores(doc.data());
      });

      const fetchPlayers = async () => {
        const playersSnapshot = await getDocs(collection(db, 'players'));
        setPlayers(playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      };
      fetchPlayers();

      return () => {
        liveUnsubscribe();
        historyUnsubscribe();
        leaderboardUnsubscribe();
        strokePlayUnsubscribe();
      };
    }
  }, [authenticated]);

  // Sync teamPoints state with DB data when it loads
  useEffect(() => {
    if (leaderboards['Golden Boys']) setTeamPoints(prev => ({ ...prev, goldenBoys: leaderboards['Golden Boys'].points }));
    if (leaderboards['Putt Pirates']) setTeamPoints(prev => ({ ...prev, puttPirates: leaderboards['Putt Pirates'].points }));
  }, [leaderboards]);

  const sortedLiveMatches = useMemo(() => {
    return liveMatches
      .filter(match => {
        // A match is only "active" if it has actual players assigned and a real course name
        // This filters out placeholder/stale data that may exist in the DB
        const hasPlayers = (match.player1 || (match.team1 && match.team1.length > 0)) && 
                          (match.player2 || (match.team2 && match.team2.length > 0) || match.soloPlayer);
        const hasCourse = match.courseName && match.courseName !== '.' && match.courseName !== 'Unknown';
        return hasPlayers && hasCourse;
      })
      .sort((a, b) => a.teeTime?.localeCompare(b.teeTime));
  }, [liveMatches]);
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => a.name.localeCompare(b.name)), [players]);
  const existingStrokeScores = useMemo(() => Object.entries(strokePlayScores).sort((a, b) => b[1].date?.localeCompare(a[1].date)), [strokePlayScores]);

  const teamStandings = useMemo(() => {
    const allowedTeams = ['Golden Boys', 'Putt Pirates'];
    return Object.entries(leaderboards)
      .filter(([team, data]) => allowedTeams.includes(team) && data && typeof data === 'object' && data.points !== undefined)
      .map(([team, data]) => ({ name: team, points: data.points || 0 }))
      .sort((a, b) => b.points - a.points);
  }, [leaderboards]);

  const strokePlayStandings = useMemo(() => {
    const playerTotals = {};
    Object.values(strokePlayScores).forEach(score => {
      if (!playerTotals[score.player]) playerTotals[score.player] = { player: score.player, totalScore: 0, rounds: [] };
      playerTotals[score.player].totalScore += parseInt(score.score);
      playerTotals[score.player].rounds.push(score);
    });
    return Object.values(playerTotals).sort((a, b) => a.totalScore - b.totalScore);
  }, [strokePlayScores]);

  const handleUpdateTeamPoints = async (team, points) => {
    try {
      const db = getFirestore();
      await setDoc(doc(db, 'leaderboards', '2025'), { [team]: { points: parseInt(points) } }, { merge: true });
      setUpdateMessage(`${team} points updated!`);
      setTimeout(() => setUpdateMessage(''), 5000);
    } catch (error) {
      console.error('Error updating points:', error);
      setUpdateMessage('Error updating points.');
      setTimeout(() => setUpdateMessage(''), 5000);
    }
  };

  const handleAddStrokeScore = async () => {
    if (!newStrokeScore.player || !newStrokeScore.date || !newStrokeScore.score) {
      setUpdateMessage('Please fill in all fields');
      setTimeout(() => setUpdateMessage(''), 5000);
      return;
    }
    try {
      const db = getFirestore();
      const scoreKey = `${newStrokeScore.date}-${newStrokeScore.player}`;
      await setDoc(doc(db, 'strokePlay', '2025'), { [scoreKey]: { player: newStrokeScore.player, date: newStrokeScore.date, score: parseInt(newStrokeScore.score), submittedAt: new Date() } }, { merge: true });
      setNewStrokeScore({ player: '', date: '', score: '' });
      setUpdateMessage(`Score added for ${newStrokeScore.player}!`);
      setTimeout(() => setUpdateMessage(''), 5000);
    } catch (error) {
      setUpdateMessage('Error adding score.');
      setTimeout(() => setUpdateMessage(''), 5000);
    }
  };

  const handleDeleteStrokeScore = async (scoreKey) => {
    try {
      const db = getFirestore();
      await setDoc(doc(db, 'strokePlay', '2025'), { [scoreKey]: deleteField() }, { merge: true });
      setUpdateMessage('Score deleted successfully!');
      setConfirmingId(null);
      setTimeout(() => setUpdateMessage(''), 5000);
    } catch (error) {
      setUpdateMessage('Error deleting score.');
      setConfirmingId(null);
      setTimeout(() => setUpdateMessage(''), 5000);
    }
  };

  const handleCompleteMatch = async (match) => {
    try {
      const db = getFirestore();
      const updatedMatch = { ...match, status: 'completed', completedAt: new Date() };
      await setDoc(doc(db, 'matchHistory', '2025'), { [match.id]: updatedMatch }, { merge: true });
      await setDoc(doc(db, 'liveMatches', '2025'), { [match.id]: deleteField() }, { merge: true });
      setConfirmingId(null);
    } catch (error) {
      console.error('Error completing match:', error);
      setConfirmingId(null);
    }
  };

  const handleDeleteMatch = async (match) => {
    try {
      const db = getFirestore();
      await setDoc(doc(db, 'liveMatches', '2025'), { [match.id]: deleteField() }, { merge: true });
      setConfirmingId(null);
    } catch (error) {
      console.error('Error deleting match:', error);
      setConfirmingId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Match Results - Guyscorp</title>
        <meta name="description" content="Live match results and scoring" />
      </Head>
      <div className="app-wrapper">
        {authenticated && <NavigationMenu />}
        <FloatingNavigation />
        <div className="home-container">
          <div className="overlay"></div>
          <div className="content">
            <h1 className="text-4xl font-semibold mb-8 cursive-font text-center">Match Results</h1>
            
            <div className="results-navigation mb-4">
              <div className="nav-tabs-container">
                <Button variant={activeTab === 'live' ? 'success' : 'outline-success'} className="nav-tab" onClick={() => setActiveTab('live')}>Active Matches</Button>
                <Button variant={activeTab === 'leaderboards' ? 'success' : 'outline-success'} className="nav-tab" onClick={() => setActiveTab('leaderboards')}>Leaderboard</Button>
                <Button variant={activeTab === 'management' ? 'success' : 'outline-success'} className="nav-tab" onClick={() => setActiveTab('management')}>Points Management</Button>
                <Button variant={activeTab === 'history' ? 'success' : 'outline-success'} className="nav-tab" onClick={() => setActiveTab('history')}>Match History</Button>
              </div>
            </div>

            {loading ? <div className="text-center py-5 text-success"><h4>Loading...</h4></div> : (
              <div className="results-content">
                {activeTab === 'live' && <LiveMatchesTab liveMatches={liveMatches} sortedLiveMatches={sortedLiveMatches} setSelectedMatch={setSelectedMatch} setShowScoreModal={setShowScoreModal} handleCompleteMatch={handleCompleteMatch} handleDeleteMatch={handleDeleteMatch} confirmingId={confirmingId} setConfirmingId={setConfirmingId} />}
                {activeTab === 'leaderboards' && <LeaderboardsTab teamStandings={teamStandings} strokePlayStandings={strokePlayStandings} />}
                {activeTab === 'management' && <PointsManagementTab players={players} sortedPlayers={sortedPlayers} existingStrokeScores={existingStrokeScores} teamPoints={teamPoints} setTeamPoints={setTeamPoints} updateMessage={updateMessage} newStrokeScore={newStrokeScore} setNewStrokeScore={setNewStrokeScore} handleUpdateTeamPoints={handleUpdateTeamPoints} handleAddStrokeScore={handleAddStrokeScore} handleDeleteStrokeScore={handleDeleteStrokeScore} confirmingId={confirmingId} setConfirmingId={setConfirmingId} />}
                {activeTab === 'history' && <MatchHistoryTab matchHistory={matchHistory} />}
              </div>
            )}
          </div>
        </div>
      </div>
      <ScoreEntryModal show={showScoreModal} onHide={() => setShowScoreModal(false)} match={selectedMatch} onSave={(updatedMatch) => setSelectedMatch(updatedMatch)} />
    </>
  );
};

export default Results;