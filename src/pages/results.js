import { useState, useEffect, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Navbar, Nav, Container, Button, Form, Badge, Card, Row, Col } from 'react-bootstrap';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, query, orderBy, deleteField, getDoc } from 'firebase/firestore';
import { getPlayerHandicaps, getPlayers, getRedhawkAdjustments } from '../firebase';
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
  setConfirmingId,
  effectiveHandicaps
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
                    {match.handicapMode && (
                      <Badge
                        bg={match.handicapMode === 'tournament' ? 'warning' : 'secondary'}
                        text={match.handicapMode === 'tournament' ? 'dark' : undefined}
                        className="ms-2"
                      >
                        {match.handicapMode === 'tournament' ? '🏆 Tourn. HCPs' : '⛳ Regular HCPs'}
                      </Badge>
                    )}
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
                          {match.matchType === '1v1' && effectiveHandicaps && (() => {
                            const p1Name = typeof match.player1 === 'string' ? match.player1 : match.player1?.name;
                            const hdcp = effectiveHandicaps[p1Name];
                            return hdcp !== undefined ? <small className="text-success fw-semibold">HDCP: {hdcp.toFixed(1)}</small> : null;
                          })()}
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
                          {match.matchType === '1v1' && effectiveHandicaps && (() => {
                            const p2Name = typeof match.player2 === 'string' ? match.player2 : match.player2?.name;
                            const hdcp = effectiveHandicaps[p2Name];
                            return hdcp !== undefined ? <small className="text-success fw-semibold">HDCP: {hdcp.toFixed(1)}</small> : null;
                          })()}
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
                {match.strokesGiven > 0 && (
                  <div className="text-center mb-2">
                    <small className="text-muted">
                      {match.receivingStrokes} receives +{match.strokesGiven} strokes
                    </small>
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
    </Row>
    <Row>
      <Col lg={12} className="mb-4">
        <Card style={{ border: '1px solid #d4d4d4', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.10)' }}>
          <Card.Header style={{ background: '#1a3a1a', borderBottom: '3px solid #2d6a2d', padding: '12px 16px' }}>
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0 text-white fw-bold" style={{ letterSpacing: '0.5px' }}>⛳ Stroke Play Leaderboard</h5>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 500 }}>{strokePlayStandings.length} players</span>
            </div>
          </Card.Header>
          <Card.Body className="p-0" style={{ background: '#fff' }}>
            {strokePlayStandings.length > 0 ? (
              <div className="table-responsive">
                <table className="table mb-0" style={{ borderCollapse: 'collapse', background: '#fff' }}>
                  <thead>
                    <tr style={{ background: '#f0f0f0', borderBottom: '2px solid #c8c8c8' }}>
                      <th className="ps-3 py-2 fw-semibold" style={{ width: '3rem', color: '#555', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>POS</th>
                      <th className="py-2 fw-semibold" style={{ color: '#555', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PLAYER</th>
                      <th className="py-2 fw-semibold text-center" style={{ width: '5rem', color: '#555', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>RDS</th>
                      <th className="py-2 fw-semibold" style={{ minWidth: '14rem', color: '#555', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ROUND SCORES</th>
                      <th className="pe-3 py-2 fw-semibold text-end" style={{ width: '6rem', color: '#555', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strokePlayStandings.map((player, idx) => {
                      const sortedRounds = [...player.rounds].sort((a, b) => a.date?.localeCompare(b.date));
                      const isLeader = idx === 0;
                      return (
                        <tr
                          key={player.player}
                          style={{
                            borderBottom: '1px solid #e8e8e8',
                            background: isLeader ? '#f9fff9' : '#fff',
                          }}
                        >
                          <td className="ps-3 py-2 align-middle" style={{ color: isLeader ? '#1a3a1a' : '#888', fontWeight: isLeader ? 700 : 400, fontSize: '0.9rem' }}>
                            {isLeader ? '🥇' : idx + 1}
                          </td>
                          <td className="py-2 align-middle" style={{ color: '#1a1a1a', fontWeight: 600, fontSize: '0.95rem' }}>
                            {player.player}
                            {isLeader && <span className="ms-2 badge" style={{ background: '#2d6a2d', color: '#fff', fontSize: '0.65rem', fontWeight: 600, verticalAlign: 'middle' }}>LEADER</span>}
                          </td>
                          <td className="py-2 text-center align-middle">
                            <span className="badge rounded-pill" style={{ background: '#e8e8e8', color: '#555', fontWeight: 500 }}>{sortedRounds.length}</span>
                          </td>
                          <td className="py-2 align-middle">
                            <div className="d-flex flex-wrap gap-1">
                              {sortedRounds.map((round, rIdx) => (
                                <span
                                  key={rIdx}
                                  title={round.date}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: '#f5f5f5',
                                    border: '1px solid #ddd',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    color: '#c0392b',
                                  }}
                                >
                                  {round.score > 0 ? `+${round.score}` : round.score}
                                  <span style={{ color: '#888', fontWeight: 400, fontSize: '0.72rem' }}>
                                    {round.date ? new Date(round.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="pe-3 py-2 text-end align-middle">
                            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#c0392b' }}>
                              +{player.totalScore}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-muted text-center py-4">No stroke play scores available</p>}
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
  setConfirmingId,
  effectiveHandicaps
}) => {
  // Compute the lowest tournament handicap across all players
  const hcpValues = Object.values(effectiveHandicaps || {});
  const lowestHcp = hcpValues.length > 0 ? Math.min(...hcpValues) : null;

  // Compute live adjusted score preview
  const playerHcp = newStrokeScore.player && effectiveHandicaps ? effectiveHandicaps[newStrokeScore.player] : null;
  const strokesGiven = (playerHcp !== null && playerHcp !== undefined && lowestHcp !== null)
    ? Math.round(playerHcp - lowestHcp)
    : null;
  const rawScore = newStrokeScore.rawScore !== '' ? parseInt(newStrokeScore.rawScore) : null;
  const par = newStrokeScore.par !== '' ? parseInt(newStrokeScore.par) : 72;
  const adjustedScore = (rawScore !== null && strokesGiven !== null)
    ? rawScore - strokesGiven - par
    : null;

  return (
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
              {newStrokeScore.player && playerHcp !== undefined && playerHcp !== null && lowestHcp !== null && (
                <small className="text-muted d-block mt-1">
                  Tournament HCP: <strong>{playerHcp.toFixed(1)}</strong>
                  {strokesGiven > 0 && <span className="ms-2 text-success">receives <strong>{strokesGiven}</strong> stroke{strokesGiven !== 1 ? 's' : ''}</span>}
                  {strokesGiven === 0 && <span className="ms-2 badge bg-warning text-dark">Field Leader — plays at scratch</span>}
                </small>
              )}
            </div>
            <div className="mb-3">
              <label className="form-label">Date</label>
              <Form.Control type="date" value={newStrokeScore.date} onChange={(e) => setNewStrokeScore(prev => ({ ...prev, date: e.target.value }))} />
            </div>
            <Row className="mb-3">
              <Col>
                <label className="form-label">Raw Score (total strokes)</label>
                <Form.Control
                  type="number"
                  value={newStrokeScore.rawScore}
                  onChange={(e) => setNewStrokeScore(prev => ({ ...prev, rawScore: e.target.value }))}
                  placeholder="e.g. 90"
                />
              </Col>
              <Col xs={4}>
                <label className="form-label">Par</label>
                <Form.Control
                  type="number"
                  value={newStrokeScore.par}
                  onChange={(e) => setNewStrokeScore(prev => ({ ...prev, par: e.target.value }))}
                  placeholder="72"
                />
              </Col>
            </Row>

            {/* Live calculation preview */}
            {adjustedScore !== null ? (
              <div className="mb-3 p-3 rounded" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <small className="text-muted d-block">Calculation</small>
                    <small className="text-muted">
                      {rawScore} (raw) − {strokesGiven} (strokes) − {par} (par) =
                    </small>
                  </div>
                  <span className="fw-bold fs-4" style={{ color: adjustedScore <= 0 ? '#2ecc71' : '#e74c3c' }}>
                    {adjustedScore > 0 ? `+${adjustedScore}` : adjustedScore}
                  </span>
                </div>
              </div>
            ) : (
              newStrokeScore.player && rawScore === null && (
                <div className="mb-3">
                  <small className="text-muted">Enter a raw score to see the adjusted result</small>
                </div>
              )
            )}

            <Button variant="success" className="w-100" onClick={handleAddStrokeScore}
              disabled={adjustedScore === null || !newStrokeScore.player || !newStrokeScore.date}>
              Add Score
            </Button>
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
};

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
  const [newStrokeScore, setNewStrokeScore] = useState({ player: '', date: '', rawScore: '', par: '72' });
  const [confirmingId, setConfirmingId] = useState(null);
  const [useTournamentHandicaps, setUseTournamentHandicaps] = useState(true);
  const [redhawkAdjustments, setRedhawkAdjustments] = useState({});
  const [baseHandicaps, setBaseHandicaps] = useState({});

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

      // Fetch base handicaps and redhawk adjustments for the HCP toggle
      const fetchHandicapData = async () => {
        try {
          const [playerHcps, adjustments] = await Promise.all([
            getPlayerHandicaps(),
            getRedhawkAdjustments()
          ]);
          const hcpMap = Object.fromEntries(playerHcps.map(e => [e.name, e.handicap]));
          setBaseHandicaps(hcpMap);
          setRedhawkAdjustments(adjustments);
        } catch (err) {
          console.error('Error fetching handicap data for results:', err);
        }
      };
      fetchHandicapData();

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

  // Compute effective handicaps: tournament (base + redhawk delta) or regular (base only)
  const effectiveHandicaps = useMemo(() => {
    if (!useTournamentHandicaps) return baseHandicaps;
    const adjusted = { ...baseHandicaps };
    Object.keys(adjusted).forEach(name => {
      const delta = redhawkAdjustments[name]?.delta || 0;
      adjusted[name] = parseFloat((adjusted[name] + delta).toFixed(1));
    });
    return adjusted;
  }, [baseHandicaps, redhawkAdjustments, useTournamentHandicaps]);
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
    if (!newStrokeScore.player || !newStrokeScore.date || newStrokeScore.rawScore === '') {
      setUpdateMessage('Please fill in all fields');
      setTimeout(() => setUpdateMessage(''), 5000);
      return;
    }
    // Compute the adjusted score from raw score, par, and handicap strokes
    const hcpValues = Object.values(effectiveHandicaps || {});
    const lowestHcp = hcpValues.length > 0 ? Math.min(...hcpValues) : 0;
    const playerHcp = effectiveHandicaps?.[newStrokeScore.player] ?? lowestHcp;
    const strokesGiven = Math.round(playerHcp - lowestHcp);
    const par = parseInt(newStrokeScore.par) || 72;
    const rawScore = parseInt(newStrokeScore.rawScore);
    const adjustedScore = rawScore - strokesGiven - par;
    try {
      const db = getFirestore();
      const scoreKey = `${newStrokeScore.date}-${newStrokeScore.player}`;
      await setDoc(doc(db, 'strokePlay', '2025'), {
        [scoreKey]: {
          player: newStrokeScore.player,
          date: newStrokeScore.date,
          score: adjustedScore,
          rawScore,
          par,
          strokesGiven,
          submittedAt: new Date()
        }
      }, { merge: true });
      setNewStrokeScore({ player: '', date: '', rawScore: '', par: '72' });
      setUpdateMessage(`Score added for ${newStrokeScore.player}! (${rawScore} raw → ${adjustedScore > 0 ? '+' : ''}${adjustedScore} adjusted)`);
      setTimeout(() => setUpdateMessage(''), 6000);
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
              <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
                <div className="d-flex align-items-center gap-2">
                  <span className="text-muted small fw-semibold">Handicap Mode:</span>
                  <div className="btn-group btn-group-sm" role="group" aria-label="Handicap mode selection">
                    <button
                      id="results-btn-tournament-hcp"
                      className={`btn ${useTournamentHandicaps ? 'btn-success' : 'btn-outline-success'}`}
                      onClick={() => setUseTournamentHandicaps(true)}
                      title="Show Redhawk-adjusted tournament handicaps"
                    >
                      🏆 Tournament HCP
                    </button>
                    <button
                      id="results-btn-regular-hcp"
                      className={`btn ${!useTournamentHandicaps ? 'btn-success' : 'btn-outline-success'}`}
                      onClick={() => setUseTournamentHandicaps(false)}
                      title="Show base calculated handicaps"
                    >
                      ⛳ Regular HCP
                    </button>
                  </div>
                </div>
              </div>
              <div className="nav-tabs-container">
                <Button variant={activeTab === 'live' ? 'success' : 'outline-success'} className="nav-tab" onClick={() => setActiveTab('live')}>Active Matches</Button>
                <Button variant={activeTab === 'leaderboards' ? 'success' : 'outline-success'} className="nav-tab" onClick={() => setActiveTab('leaderboards')}>Leaderboard</Button>
                <Button variant={activeTab === 'management' ? 'success' : 'outline-success'} className="nav-tab" onClick={() => setActiveTab('management')}>Points Management</Button>
                <Button variant={activeTab === 'history' ? 'success' : 'outline-success'} className="nav-tab" onClick={() => setActiveTab('history')}>Match History</Button>
              </div>
            </div>

            {loading ? <div className="text-center py-5 text-success"><h4>Loading...</h4></div> : (
              <div className="results-content">
                {activeTab === 'live' && <LiveMatchesTab liveMatches={liveMatches} sortedLiveMatches={sortedLiveMatches} setSelectedMatch={setSelectedMatch} setShowScoreModal={setShowScoreModal} handleCompleteMatch={handleCompleteMatch} handleDeleteMatch={handleDeleteMatch} confirmingId={confirmingId} setConfirmingId={setConfirmingId} effectiveHandicaps={effectiveHandicaps} />}
                {activeTab === 'leaderboards' && <LeaderboardsTab teamStandings={teamStandings} strokePlayStandings={strokePlayStandings} />}
                {activeTab === 'management' && <PointsManagementTab players={players} sortedPlayers={sortedPlayers} existingStrokeScores={existingStrokeScores} teamPoints={teamPoints} setTeamPoints={setTeamPoints} updateMessage={updateMessage} newStrokeScore={newStrokeScore} setNewStrokeScore={setNewStrokeScore} handleUpdateTeamPoints={handleUpdateTeamPoints} handleAddStrokeScore={handleAddStrokeScore} handleDeleteStrokeScore={handleDeleteStrokeScore} confirmingId={confirmingId} setConfirmingId={setConfirmingId} effectiveHandicaps={effectiveHandicaps} />}
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