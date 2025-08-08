import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Navbar, Nav, Container, Button, Form, Badge, Card, Row, Col } from 'react-bootstrap';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, query, orderBy, deleteField, getDoc } from 'firebase/firestore';
import { getPlayerHandicaps, getPlayers } from '../firebase';
import NavigationMenu from '../components/NavigationMenu';
import FloatingNavigation from '../components/FloatingNavigation';
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

  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const router = useRouter();

  useEffect(() => {
    // TEMPORARILY DISABLED AUTHENTICATION FOR TOURNAMENT WEEKEND
    // const auth = getAuth();
    // const unsubscribe = onAuthStateChanged(auth, (user) => {
    //   if (user) {
    //     setAuthenticated(true);
    //   } else {
    //     setAuthenticated(false);
    //   }
    // });
    // return () => unsubscribe();
    
    // Always authenticated for tournament weekend
    setAuthenticated(true);
  }, [router]);

    useEffect(() => {
    const db = getFirestore();
    
    // Fetch players data
    const fetchPlayers = async () => {
      try {
        const playerList = await getPlayers();
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
          const data = doc.data();
          console.log('Stroke play scores loaded:', data);
          setStrokePlayScores(data);
        } else {
          console.log('No stroke play scores found');
          setStrokePlayScores({});
        }
      });





      setLoading(false);

      return () => {
        liveMatchesUnsubscribe();
        historyUnsubscribe();
        leaderboardsUnsubscribe();
        courseStatsUnsubscribe();
        strokePlayUnsubscribe();
      };
  }, []);

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
      // Regular match format
      const { player1Score, player2Score, holesPlayed } = match.currentScore;
      const diff = player1Score - player2Score;
      
      if (diff === 0) return 'All Square';
      if (diff > 0) {
        // Player 1 is up
        if (match.matchType === 'alternating') {
          return `${typeof match.soloPlayer === 'string' ? match.soloPlayer : match.soloPlayer.name} ${diff}UP`;
        } else {
                      return `${typeof match.player1 === 'string' ? match.player1 : (match.player1?.name || 'Unknown Player')} ${diff}UP`;
        }
      } else {
        // Player 2 is up
        if (match.matchType === 'alternating') {
          return `${match.team2Players?.map(p => typeof p === 'string' ? p : p.name).join(' & ')} ${Math.abs(diff)}UP`;
        } else {
                      return `${typeof match.player2 === 'string' ? match.player2 : (match.player2?.name || 'Unknown Player')} ${Math.abs(diff)}UP`;
        }
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

  const formatTeeTime = (time24) => {
    if (!time24) return '';
    
    // Handle times like "7:30", "14:53", etc.
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
      if (hole.result === 'team1_win') {
        return `${match.team1?.name || 'Putt Pirates'} wins`;
      } else if (hole.result === 'team2_win') {
        return `${match.team2?.name || 'Golden Boys'} wins`;
      } else {
        return 'Tie';
      }
    } else if (match.matchType === 'alternating') {
      if (hole.result === 'player1_win') {
        return `${typeof match.soloPlayer === 'string' ? match.soloPlayer : match.soloPlayer?.name || 'Unknown Player'} wins`;
      } else if (hole.result === 'player2_win') {
        return `${match.team2Players?.map(p => typeof p === 'string' ? p : p.name).join(' & ') || 'Unknown Team'} wins`;
      } else {
        return 'Tie';
      }
    } else {
      // 1v1 match
      if (hole.result === 'player1_win') {
        return `${typeof match.player1 === 'string' ? match.player1 : match.player1?.name || 'Unknown Player'} wins`;
      } else if (hole.result === 'player2_win') {
        return `${typeof match.player2 === 'string' ? match.player2 : match.player2?.name || 'Unknown Player'} wins`;
      } else {
        return 'Tie';
      }
    }
  };

  const handleCompleteMatch = async (match) => {
    if (!confirm('Are you sure you want to complete this match?')) return;

    try {
      console.log('Completing match:', match);
      const db = getFirestore();
      const currentScore = match.currentScore || { player1Score: 0, player2Score: 0 };
      
      console.log('Current score:', currentScore);
      
      // Determine winner and final score
      let winner, loser, finalScore;
      
      if (match.matchType === 'championship') {
        const { team1Wins = 0, team2Wins = 0 } = currentScore;
        winner = team1Wins > team2Wins ? match.team1?.name : match.team2?.name;
        loser = team1Wins > team2Wins ? match.team2?.name : match.team1?.name;
        finalScore = team1Wins > team2Wins ? 
          `${team1Wins}&${team2Wins}` : 
          `${team2Wins}&${team1Wins}`;
      } else {
        // Simplified winner/loser logic
        const player1Score = currentScore.player1Score || 0;
        const player2Score = currentScore.player2Score || 0;
        
        console.log(`Player scores: ${player1Score} vs ${player2Score}`);
        
        if (match.matchType === 'alternating') {
          const soloPlayer = typeof match.soloPlayer === 'string' ? match.soloPlayer : (match.soloPlayer?.name || 'Unknown Player');
          const team2Players = match.team2Players?.map(p => typeof p === 'string' ? p : p.name).join(' & ') || 'Unknown Team';
          
          if (player1Score > player2Score) {
            winner = soloPlayer;
            loser = team2Players;
            finalScore = `${player1Score}&${player2Score}`;
          } else {
            winner = team2Players;
            loser = soloPlayer;
            finalScore = `${player2Score}&${player1Score}`;
          }
        } else {
          // 1v1 match
          const player1 = typeof match.player1 === 'string' ? match.player1 : (match.player1?.name || 'Unknown Player');
          const player2 = typeof match.player2 === 'string' ? match.player2 : (match.player2?.name || 'Unknown Player');
          
          if (player1Score > player2Score) {
            winner = player1;
            loser = player2;
            finalScore = `${player1Score}&${player2Score}`;
          } else {
            winner = player2;
            loser = player1;
            finalScore = `${player2Score}&${player1Score}`;
          }
        }
      }
      
      console.log(`Winner: ${winner}, Loser: ${loser}, Final Score: ${finalScore}`);

      // Calculate actual duration (only if match has started)
      let duration = '0h 0m';
      if (match.lastUpdate) {
        // Handle Firestore Timestamp properly
        const startTime = match.lastUpdate.toDate ? match.lastUpdate.toDate() : new Date(match.lastUpdate);
        const endTime = new Date();
        const durationMs = endTime - startTime;
        
        // Handle very short durations (less than 1 minute)
        if (durationMs < 60000) {
          duration = '<1 min';
        } else {
          const hours = Math.floor(durationMs / (1000 * 60 * 60));
          const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
          
          // Ensure we don't get NaN values and handle edge cases
          if (isNaN(hours) || isNaN(minutes)) {
            duration = '<1 min';
          } else if (hours === 0 && minutes === 0) {
            // If both hours and minutes are 0, show <1 min
            duration = '<1 min';
          } else {
            duration = `${hours}h ${minutes}m`;
          }
        }
        

      }

      // Move to history with robust null checking
      const historyData = {
        courseName: match.courseName || 'Unknown Course',
        date: match.date ? match.date : new Date().toISOString().split('T')[0],
        winner: winner || 'Unknown',
        loser: loser || 'Unknown',
        finalScore: finalScore || '0&0',
        duration: duration || '0h 0m',
        completedAt: new Date()
      };

      if (match.matchType === 'championship') {
        historyData.matchType = 'championship';
        historyData.team1 = match.team1 || {};
        historyData.team2 = match.team2 || {};
        historyData.holeResults = match.holeResults || {};
      } else {
        historyData.teeTime = match.teeTime || 'Unknown';
        historyData.player1 = match.matchType === 'alternating' ? 
          (typeof match.soloPlayer === 'string' ? match.soloPlayer : (match.soloPlayer?.name || 'Unknown Player')) : 
          (typeof match.player1 === 'string' ? match.player1 : (match.player1?.name || 'Unknown Player'));
        historyData.player2 = match.matchType === 'alternating' ? 
          (match.team2Players?.map(p => typeof p === 'string' ? p : p.name).join(' & ') || 'Unknown Team') : 
          (typeof match.player2 === 'string' ? match.player2 : (match.player2?.name || 'Unknown Player'));
      }
      
      console.log('History data:', historyData);
      console.log('Match ID:', match.id);

      // Ensure match ID is valid
      const matchId = match.id || `match-${Date.now()}`;
      
      await setDoc(doc(db, 'matchHistory', '2025'), {
        [matchId]: historyData
      }, { merge: true });

      // Remove from live matches
      await setDoc(doc(db, 'liveMatches', '2025'), {
        [match.id]: null
      }, { merge: true });

      alert('Match completed successfully!');
    } catch (error) {
      console.error('Error completing match:', error);
      console.error('Match data:', match);
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
          {liveMatches
            .sort((a, b) => {
              // Sort by status priority: in_progress first, then not_started, then others
              const statusPriority = {
                'in_progress': 1,
                'not_started': 2,
                'completed': 3,
                'match_ready_to_complete': 4
              };
              
              const aPriority = statusPriority[a.status] || 5;
              const bPriority = statusPriority[b.status] || 5;
              
              if (aPriority !== bPriority) {
                return aPriority - bPriority;
              }
              
              // If same status, sort by course name and tee time
              if (a.courseName !== b.courseName) {
                return a.courseName.localeCompare(b.courseName);
              }
              
              return (a.teeTime || '').localeCompare(b.teeTime || '');
            })
            .map((match) => (
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
                    {formatTeeTime(match.teeTime)} • {match.date}
                  </small>
                </Card.Header>
                <Card.Body>
                                     <div className="match-players mb-3">
                    {match.matchType === 'championship' ? (
                      // Championship format display
                      <div>
                        <div className="player-row d-flex justify-content-between align-items-center">
                          <div className="d-flex flex-column">
                            <span className="player-name">{match.team1?.name || 'Putt Pirates'}</span>
                            <small className="text-muted">
                              {match.team1?.players?.map(p => typeof p === 'string' ? p : p.name).join(', ') || 'No players assigned'}
                            </small>
                          </div>
                          <span className="player-score">{match.currentScore?.team1Wins || 0}</span>
                        </div>
                        <div className="player-row d-flex justify-content-between align-items-center">
                          <div className="d-flex flex-column">
                            <span className="player-name">{match.team2?.name || 'Golden Boys'}</span>
                            <small className="text-muted">
                              {match.team2?.players?.map(p => typeof p === 'string' ? p : p.name).join(', ') || 'No players assigned'}
                            </small>
                          </div>
                          <span className="player-score">{match.currentScore?.team2Wins || 0}</span>
                        </div>
                      </div>
                    ) : (
                      // Regular match format display
                      <div>
                        <div className="player-row d-flex justify-content-between align-items-center">
                          <div className="d-flex flex-column">
                            <span className="player-name">
                              {match.matchType === 'alternating' ? (typeof match.soloPlayer === 'string' ? match.soloPlayer : (match.soloPlayer?.name || 'Unknown Player')) : (typeof match.player1 === 'string' ? match.player1 : (match.player1?.name || 'Unknown Player'))}
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
                              {match.matchType === 'alternating' ? match.team2Players?.map(p => typeof p === 'string' ? p : p.name).join(' & ') : (typeof match.player2 === 'string' ? match.player2 : (match.player2?.name || 'Unknown Player'))}
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
                    )}
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
                        {match.currentScore.recentHoles?.slice(-6).map((hole, idx) => {
                          const holeText = formatHoleResult(match, hole);
                          return (
                            <Badge 
                              key={idx} 
                              bg={hole.result === 'player1_win' || hole.result === 'team1_win' ? 'success' : 
                                  hole.result === 'player2_win' || hole.result === 'team2_win' ? 'danger' : 'secondary'}
                              className="hole-badge"
                            >
                              H{hole.number}: {holeText}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="match-footer mt-3 pt-3 border-top">
                    <small className="text-muted">
                      {match.lastUpdate ? `Last updated: ${formatTime(match.lastUpdate)}` : 'Match not started yet'}
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
                      {match.date} • {formatTeeTime(match.teeTime)}
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
                    <span className="text-success">
                      {match.duration && typeof match.duration === 'string' ? match.duration : '0h 0m'}
                    </span>
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
            rounds: []
          };
        }
        playerCumulativeScores[player].totalScore += data.score;
        playerCumulativeScores[player].rounds.push({
          date: data.date,
          score: data.score
        });
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
                             {player.rounds.length} rounds
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



  const PointsManagementTab = () => {
    const [teamPoints, setTeamPoints] = useState({
      goldenBoys: 0,
      puttPirates: 0
    });
    // Use global strokePlayScores state instead of local state
    const [newStrokeScore, setNewStrokeScore] = useState({
      player: '',
      date: '',
      score: ''
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
      if (!newStrokeScore.player || !newStrokeScore.date || !newStrokeScore.score) {
        alert('Please fill in all fields');
        return;
      }

      try {
        const db = getFirestore();
        const scoreKey = `${newStrokeScore.date}-${newStrokeScore.player}`;
        
        // Save to stroke play collection
        await setDoc(doc(db, 'strokePlay', '2025'), {
          [scoreKey]: {
            player: newStrokeScore.player,
            date: newStrokeScore.date,
            score: parseInt(newStrokeScore.score),
            submittedAt: new Date()
          }
        }, { merge: true });

        setNewStrokeScore({ player: '', date: '', score: '' });
        alert(`Stroke play score added successfully!`);
      } catch (error) {
        console.error('Error adding stroke play score:', error);
        alert('Error adding stroke play score. Please try again.');
      }
    };



    const handleDeleteStrokeScore = async (scoreKey) => {
      if (!confirm('Are you sure you want to delete this score?')) return;
      
      try {
        const db = getFirestore();
        console.log('Deleting score with key:', scoreKey);
        console.log('Score data:', strokePlayScores[scoreKey]);
        
        const scoreData = strokePlayScores[scoreKey];
        if (!scoreData) {
          alert('Score data not found. Please refresh and try again.');
          return;
        }
        
        const [date, player] = scoreKey.split('-');
        const course = scoreData.course;
        
        // Remove from stroke play collection
        await setDoc(doc(db, 'strokePlay', '2025'), {
          [scoreKey]: deleteField()
        }, { merge: true });


        
        alert('Score deleted successfully!');
      } catch (error) {
        console.error('Error deleting score:', error);
        alert('Error deleting score. Please try again.');
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


        </Row>

        {/* Existing Data Management */}
        <Row className="mt-4">
          <Col lg={6} md={12} className="mb-4">
            <Card>
              <Card.Header>
                <h5 className="mb-0">Existing Stroke Play Scores</h5>
              </Card.Header>
              <Card.Body>
                {console.log('Rendering stroke play scores:', strokePlayScores)}
                {Object.entries(strokePlayScores).length > 0 ? (
                  <div className="existing-scores">
                    {Object.entries(strokePlayScores)
                      .filter(([key, data]) => {
                        console.log('Filtering stroke play score:', key, data);
                        return data && typeof data === 'object' && data.score !== undefined;
                      })
                      .map(([key, data]) => (
                        <div key={key} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                          <div>
                            <strong>{data.player}</strong>
                            <br />
                            <small className="text-muted">
                              {data.date} • {data.score > 0 ? `+${data.score}` : data.score}
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

        </Row>
      </div>
    );
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
              {activeTab === 'management' && <PointsManagementTab />}
            </div>
          )}
        </div>
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
    </>
  );
};

export default Results;