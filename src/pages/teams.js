import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Badge, Modal } from 'react-bootstrap';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, setDoc, doc, onSnapshot, deleteField } from 'firebase/firestore';
import { getTeams, getPlayers, getPlayerHandicaps } from '../firebase';
import NavigationMenu from '../components/NavigationMenu';
import FloatingNavigation from '../components/FloatingNavigation';
import ChampionshipFormat from '../components/ChampionshipFormat';
import 'bootstrap/dist/css/bootstrap.min.css';
import Image from 'next/image';

const Teams = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [scheduledMatches, setScheduledMatches] = useState({});
  const [matchSelections, setMatchSelections] = useState({});
  const [showChampionshipModal, setShowChampionshipModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isRefreshingHandicaps, setIsRefreshingHandicaps] = useState(false);
  const [lastHandicapUpdate, setLastHandicapUpdate] = useState(null);

  // Schedule data - Main tournament only (no Friday warm-up round)
  const scheduleData = [
    {
      date: '2025-08-10',
      courseName: 'Treetops (Smith Signature)',
      teeTimes: ['7:30', '7:40', '7:50'],
      notes: 'Blue tees - Team Match Format'
    },
    {
      date: '2025-08-10',
      courseName: 'Treetops (Jones Masterpiece)',
      teeTimes: ['14:53', '15:04', '15:15'],
      notes: 'Blue tees - Team Match Format'
    },
    {
      date: '2025-08-11',
      courseName: 'Belvedere',
      teeTimes: ['10:10', '10:20', '10:30'],
      notes: 'Blue tees - Team Match Format'
    },
    {
      date: '2025-08-11',
      courseName: 'Threetops',
      teeTimes: ['18:40', '18:50', '19:00'],
      notes: 'Par 3 Course'
    },
    {
      date: '2025-08-12',
      courseName: 'Forest Dunes',
      teeTimes: ['9:20', '9:31', '9:42'],
      notes: 'Championship Format',
      specialFormat: { type: 'Championship' }
    }
  ];

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (authenticated) {
      const loadData = async () => {
        try {
          const teamsData = await getTeams();
          const playersData = await getPlayers();
          setTeams(teamsData);
          setPlayers(playersData);
        } catch (error) {
          console.error('Error loading data:', error);
        }
      };
      loadData();
    }
  }, [authenticated]);

  const refreshHandicaps = async () => {
    if (!authenticated) return;
    
    console.log('Starting handicap refresh...');
    setIsRefreshingHandicaps(true);
    try {
      console.log('Fetching player handicaps...');
      const playerHandicaps = await getPlayerHandicaps();
      console.log('Player handicaps received:', playerHandicaps);
      
      // Update teams with fresh handicaps
      const updatedTeams = teams.map(team => {
        console.log(`Processing team: ${team.name}`);
        const updatedPlayers = team.players?.map(player => {
          const currentHandicap = playerHandicaps.find(p => p.name === player.name);
          console.log(`Player ${player.name}: old handicap ${player.handicap}, new handicap ${currentHandicap?.handicap}`);
          return {
            ...player,
            handicap: currentHandicap?.handicap || player.handicap
          };
        }) || [];
        
        // Recalculate team average
        const averageHandicap = updatedPlayers.length 
          ? parseFloat((updatedPlayers.reduce((acc, p) => acc + p.handicap, 0) / updatedPlayers.length).toFixed(1))
          : 0;

        return {
          ...team,
          players: updatedPlayers,
          averageHandicap
        };
      });
      
      console.log('Updated teams:', updatedTeams);
      setTeams(updatedTeams);
      setLastHandicapUpdate(new Date());
      console.log('Handicaps refreshed successfully');
    } catch (error) {
      console.error('Error refreshing handicaps:', error);
    } finally {
      setIsRefreshingHandicaps(false);
    }
  };

  useEffect(() => {
    const db = getFirestore();
    const unsubscribe = onSnapshot(doc(db, 'teamMatches', '2025-scheduled'), (doc) => {
      if (doc.exists()) {
        setScheduledMatches(doc.data());
      }
    });
    return () => unsubscribe();
  }, []);

  const getRound = (time) => {
    if (!time) return 'morning';
    const hour = parseInt(time.split(':')[0]);
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  };

  const createMatch = async (courseName, round, matchType, players, teeTime) => {
    const matchId = `${courseName}-${round}-${Date.now()}`;
    const match = {
      id: matchId,
      courseName: courseName,
      round: round,
      matchType: matchType,
      teeTime: teeTime,
      status: 'not_started',
      lastUpdate: new Date(),
      currentScore: {
        player1Score: 0,
        player2Score: 0,
        holesPlayed: 0,
        holeResults: {},
        recentHoles: []
      }
    };

    if (matchType === '1v1') {
      match.player1 = players[0];
      match.player2 = players[1];
      match.sittingOut = players[2];
      
      const player1Team = teams.find(team => team.players?.some(p => p.name === players[0]))?.name || 'Unknown';
      const player2Team = teams.find(team => team.players?.some(p => p.name === players[1]))?.name || 'Unknown';
      match.player1Team = player1Team;
      match.player2Team = player2Team;
    } else if (matchType === 'alternating') {
      match.soloPlayer = players[0];
      match.team2Players = [players[1], players[2]];
      
      const soloTeam = teams.find(team => team.players?.some(p => p.name === players[0]))?.name || 'Unknown';
      const team2Team = teams.find(team => team.players?.some(p => p.name === players[1]))?.name || 'Unknown';
      match.soloTeam = soloTeam;
      match.team2Team = team2Team;
    }

    const db = getFirestore();
    try {
      await setDoc(doc(db, 'liveMatches', '2025'), {
        [matchId]: match
      }, { merge: true });
      
      await setDoc(doc(db, 'teamMatches', '2025-scheduled'), {
        [matchId]: match
      }, { merge: true });
      
      console.log('Created match:', match);
    } catch (error) {
      console.error('Error creating match:', error);
    }
  };

  const deleteMatch = async (matchId) => {
    const db = getFirestore();
    try {
      await setDoc(doc(db, 'liveMatches', '2025'), {
        [matchId]: deleteField()
      }, { merge: true });
      
      await setDoc(doc(db, 'teamMatches', '2025-scheduled'), {
        [matchId]: deleteField()
      }, { merge: true });
      
      console.log('Deleted match:', matchId);
    } catch (error) {
      console.error('Error deleting match:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTeeTime = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getAverageHandicap = (teamPlayers) => {
    if (!teamPlayers || teamPlayers.length === 0) return 0;
    const sum = teamPlayers.reduce((acc, player) => acc + (player.handicap || 0), 0);
    return (sum / teamPlayers.length).toFixed(1);
  };

  // Group matches by course
  const matchesByCourse = {};
  Object.entries(scheduledMatches).forEach(([matchId, matchData]) => {
    const courseName = matchData.courseName;
    if (!matchesByCourse[courseName]) {
      matchesByCourse[courseName] = [];
    }
    matchesByCourse[courseName].push({ matchId, matchData });
  });

  return (
    <div className="app-wrapper">
      {authenticated && <NavigationMenu />}
      <FloatingNavigation />
      <div className="home-container">
        <div className="overlay"></div>
        <div className="content">
          <h1 className="text-4xl font-semibold mb-8 cursive-font text-center">Team Setup</h1>
          
          {/* Teams Overview */}
          <div className="teams-section mb-8">
            <div className="d-flex justify-content-between align-items-center mb-6">
              <h2 className="text-3xl font-semibold text-success">Teams Overview</h2>
              {authenticated && (
                <Button
                  variant="outline-success"
                  onClick={refreshHandicaps}
                  disabled={isRefreshingHandicaps}
                  className="d-flex align-items-center"
                >
                  {isRefreshingHandicaps ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-sync-alt me-2"></i>
                      Refresh Handicaps
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {teams.length > 0 ? (
              // Teams data loaded - show actual content
              <div className="teams-grid">
                {teams.map((team, index) => (
                  <div key={index} className="team-section mb-4">
                    <div className="team-header">
                      <div className="team-logo-container">
                        <Image 
                          src={team.name === "Putt Pirates" ? "/putt-pirates-logo.jpg" : "/golden-boys-logo.jpg"}
                          alt={`${team.name} Logo`}
                          width={150} 
                          height={150} 
                          className="team-logo" 
                        />
                      </div>
                      <div className="team-info">
                        <h3 className="text-2xl font-bold">{team.name}</h3>
                        <p className="text-xl text-success">
                          Team Average: {getAverageHandicap(team.players)}
                        </p>
                        <small className="text-muted">
                          Handicaps shown are from stored team data. Click &quot;Refresh Handicaps&quot; for latest calculations.
                          {lastHandicapUpdate && (
                            <>
                              <br />
                              <span className="text-info">
                                Last updated: {lastHandicapUpdate.toLocaleTimeString()}
                              </span>
                            </>
                          )}
                        </small>
                      </div>
                    </div>
                    
                    <div className="players-list my-3">
                      {team.players?.map(player => (
                        <div key={player.name} className="player-item">
                          {player.name} - Handicap: {player.handicap}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Loading skeleton for teams
              <div className="teams-loading-skeleton">
                <div className="team-section mb-4">
                  <div className="team-header">
                    <div className="team-logo-container">
                      <div className="skeleton-logo" style={{ width: '150px', height: '150px', backgroundColor: '#e9ecef', borderRadius: '8px' }}></div>
                    </div>
                    <div className="team-info">
                      <div className="skeleton-title" style={{ width: '200px', height: '32px', backgroundColor: '#e9ecef', borderRadius: '4px', marginBottom: '8px' }}></div>
                      <div className="skeleton-subtitle" style={{ width: '150px', height: '24px', backgroundColor: '#e9ecef', borderRadius: '4px' }}></div>
                    </div>
                  </div>
                  
                  <div className="players-list my-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="skeleton-player" style={{ width: '100%', height: '20px', backgroundColor: '#e9ecef', borderRadius: '4px', marginBottom: '8px' }}></div>
                    ))}
                  </div>
                </div>
                
                <div className="team-section mb-4">
                  <div className="team-header">
                    <div className="team-logo-container">
                      <div className="skeleton-logo" style={{ width: '150px', height: '150px', backgroundColor: '#e9ecef', borderRadius: '8px' }}></div>
                    </div>
                    <div className="team-info">
                      <div className="skeleton-title" style={{ width: '200px', height: '32px', backgroundColor: '#e9ecef', borderRadius: '4px', marginBottom: '8px' }}></div>
                      <div className="skeleton-subtitle" style={{ width: '150px', height: '24px', backgroundColor: '#e9ecef', borderRadius: '4px' }}></div>
                    </div>
                  </div>
                  
                  <div className="players-list my-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="skeleton-player" style={{ width: '100%', height: '20px', backgroundColor: '#e9ecef', borderRadius: '4px', marginBottom: '8px' }}></div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Scheduled Matches */}
          {Object.keys(matchesByCourse).length > 0 && (
            <div className="scheduled-matches-section mb-8">
              <h2 className="text-3xl font-semibold mb-6 text-center text-success">Scheduled Matches</h2>
              
              {Object.entries(matchesByCourse).map(([courseName, courseMatches]) => (
                <div key={courseName} className="course-matches mb-6">
                  <h3 className="text-2xl font-bold mb-4 text-success border-bottom pb-2">
                    {courseName}
                  </h3>
                  
                  {courseMatches.map(({ matchId, matchData }) => (
                    <div key={matchId} className="match-display mb-3 p-3 bg-success text-white rounded">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <h5 className="mb-1">
                            {matchData.matchType === '1v1' ? '1v1 Match' : 'Alternating Match'} - {formatTeeTime(matchData.teeTime)}
                          </h5>
                          <div>
                            {matchData.matchType === '1v1' ? (
                              <span>{matchData.player1} vs {matchData.player2} (Sitting out: {matchData.sittingOut})</span>
                            ) : (
                              <span>{matchData.soloPlayer} vs {matchData.team2Players.join(' & ')}</span>
                            )}
                          </div>
                        </div>
                        {authenticated && (
                          <Button
                            variant="link"
                            className="text-white p-0"
                            onClick={() => deleteMatch(matchId)}
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

                    {/* Create Matches */}
          <div className="create-matches-section mb-8">
            <h2 className="text-3xl font-semibold mb-6 text-center text-success">Create Matches</h2>
            
            {/* Always show match creation interface, with loading states for dropdowns */}
            {scheduleData.map((event, eventIndex) => (
              <div key={eventIndex} className="event-section mb-6">
                <div className="event-header mb-4">
                  <h3 className="text-2xl text-success">{event.courseName}</h3>
                  <p className="text-muted">{formatDate(event.date)}</p>
                  {event.notes && (
                    <p className="text-gray-600 italic">{event.notes}</p>
                  )}
                </div>

                {/* Skip match creation for championship format */}
                {event.specialFormat?.type === 'Championship' ? (
                  <div className="text-center py-4">
                    <p className="text-muted">Championship format - use the setup button below</p>
                  </div>
                ) : (
                  <div className="tee-times">
                    {event.teeTimes.map((time, timeIndex) => {
                      const round = getRound(time);
                      
                      return (
                        <div key={timeIndex} className="tee-time-slot mb-4 p-3 border rounded bg-light">
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h4 className="text-xl mb-0">{formatTeeTime(time)} - {round.charAt(0).toUpperCase() + round.slice(1)} Round</h4>
                          </div>
                          
                          {/* 1v1 Match Creation */}
                          <div className="match-setup mb-4">
                            <h5 className="mb-3">Create 1v1 Match:</h5>
                            <div className="form-group mb-3">
                              <label className="form-label">Player 1:</label>
                              <select 
                                value={matchSelections[`${eventIndex}-${timeIndex}-1v1-player1`] || ''}
                                onChange={(e) => {
                                  setMatchSelections(prev => ({
                                    ...prev,
                                    [`${eventIndex}-${timeIndex}-1v1-player1`]: e.target.value
                                  }));
                                }}
                                className="form-control"
                                disabled={teams.length === 0}
                              >
                                <option value="">-- Choose Player 1 --</option>
                                {teams.length > 0 ? (
                                  teams.flatMap(team => team.players || []).map(player => (
                                    <option key={player.name} value={player.name}>
                                      {player.name} ({teams.find(t => t.players?.some(p => p.name === player.name))?.name || 'Unknown'})
                                    </option>
                                  ))
                                ) : (
                                  <option value="" disabled>Loading players...</option>
                                )}
                              </select>
                            </div>
                            
                            <div className="form-group mb-3">
                              <label className="form-label">Player 2:</label>
                              <select 
                                value={matchSelections[`${eventIndex}-${timeIndex}-1v1-player2`] || ''}
                                onChange={(e) => {
                                  setMatchSelections(prev => ({
                                    ...prev,
                                    [`${eventIndex}-${timeIndex}-1v1-player2`]: e.target.value
                                  }));
                                }}
                                className="form-control"
                                disabled={teams.length === 0}
                              >
                                <option value="">-- Choose Player 2 --</option>
                                {teams.length > 0 ? (
                                  teams.flatMap(team => team.players || []).map(player => (
                                    <option key={player.name} value={player.name}>
                                      {player.name} ({teams.find(t => t.players?.some(p => p.name === player.name))?.name || 'Unknown'})
                                    </option>
                                  ))
                                ) : (
                                  <option value="" disabled>Loading players...</option>
                                )}
                              </select>
                            </div>
                            
                            <div className="form-group mb-3">
                              <label className="form-label">Sitting Out:</label>
                              <select 
                                value={matchSelections[`${eventIndex}-${timeIndex}-1v1-sittingOut`] || ''}
                                onChange={(e) => {
                                  setMatchSelections(prev => ({
                                    ...prev,
                                    [`${eventIndex}-${timeIndex}-1v1-sittingOut`]: e.target.value
                                  }));
                                }}
                                className="form-control"
                                disabled={teams.length === 0}
                              >
                                <option value="">-- Choose Sitting Out Player --</option>
                                {teams.length > 0 ? (
                                  teams.flatMap(team => team.players || []).map(player => (
                                    <option key={player.name} value={player.name}>
                                      {player.name} ({teams.find(t => t.players?.some(p => p.name === player.name))?.name || 'Unknown'})
                                    </option>
                                  ))
                                ) : (
                                  <option value="" disabled>Loading players...</option>
                                )}
                              </select>
                            </div>
                            
                            <button
                              className="btn btn-success"
                              disabled={
                                teams.length === 0 ||
                                !matchSelections[`${eventIndex}-${timeIndex}-1v1-player1`] ||
                                !matchSelections[`${eventIndex}-${timeIndex}-1v1-player2`] ||
                                !matchSelections[`${eventIndex}-${timeIndex}-1v1-sittingOut`]
                              }
                              onClick={() => {
                                const player1 = matchSelections[`${eventIndex}-${timeIndex}-1v1-player1`];
                                const player2 = matchSelections[`${eventIndex}-${timeIndex}-1v1-player2`];
                                const sittingOut = matchSelections[`${eventIndex}-${timeIndex}-1v1-sittingOut`];
                                
                                if (player1 && player2 && sittingOut) {
                                  createMatch(event.courseName, round, '1v1', [player1, player2, sittingOut], time);
                                }
                              }}
                            >
                              Create 1v1 Match
                            </button>
                          </div>
                          
                          {/* Alternating Match Creation */}
                          <div className="match-setup">
                            <h5 className="mb-3">Create Alternating Match:</h5>
                            <div className="form-group mb-3">
                              <label className="form-label">Solo Player:</label>
                              <select 
                                value={matchSelections[`${eventIndex}-${timeIndex}-alt-solo`] || ''}
                                onChange={(e) => {
                                  setMatchSelections(prev => ({
                                    ...prev,
                                    [`${eventIndex}-${timeIndex}-alt-solo`]: e.target.value
                                  }));
                                }}
                                className="form-control"
                                disabled={teams.length === 0}
                              >
                                <option value="">-- Choose Solo Player --</option>
                                {teams.length > 0 ? (
                                  teams.flatMap(team => team.players || []).map(player => (
                                    <option key={player.name} value={player.name}>
                                      {player.name} ({teams.find(t => t.players?.some(p => p.name === player.name))?.name || 'Unknown'})
                                    </option>
                                  ))
                                ) : (
                                  <option value="" disabled>Loading players...</option>
                                )}
                              </select>
                            </div>
                            
                            <div className="form-group mb-3">
                              <label className="form-label">Team Player 1:</label>
                              <select 
                                value={matchSelections[`${eventIndex}-${timeIndex}-alt-team1`] || ''}
                                onChange={(e) => {
                                  setMatchSelections(prev => ({
                                    ...prev,
                                    [`${eventIndex}-${timeIndex}-alt-team1`]: e.target.value
                                  }));
                                }}
                                className="form-control"
                                disabled={teams.length === 0}
                              >
                                <option value="">-- Choose Team Player 1 --</option>
                                {teams.length > 0 ? (
                                  teams.flatMap(team => team.players || []).map(player => (
                                    <option key={player.name} value={player.name}>
                                      {player.name} ({teams.find(t => t.players?.some(p => p.name === player.name))?.name || 'Unknown'})
                                    </option>
                                  ))
                                ) : (
                                  <option value="" disabled>Loading players...</option>
                                )}
                              </select>
                            </div>
                            
                            <div className="form-group mb-3">
                              <label className="form-label">Team Player 2:</label>
                              <select 
                                value={matchSelections[`${eventIndex}-${timeIndex}-alt-team2`] || ''}
                                onChange={(e) => {
                                  setMatchSelections(prev => ({
                                    ...prev,
                                    [`${eventIndex}-${timeIndex}-alt-team2`]: e.target.value
                                  }));
                                }}
                                className="form-control"
                                disabled={teams.length === 0}
                              >
                                <option value="">-- Choose Team Player 2 --</option>
                                {teams.length > 0 ? (
                                  teams.flatMap(team => team.players || []).map(player => (
                                    <option key={player.name} value={player.name}>
                                      {player.name} ({teams.find(t => t.players?.some(p => p.name === player.name))?.name || 'Unknown'})
                                    </option>
                                  ))
                                ) : (
                                  <option value="" disabled>Loading players...</option>
                                )}
                              </select>
                            </div>
                            
                            <button
                              className="btn btn-success"
                              disabled={
                                teams.length === 0 ||
                                !matchSelections[`${eventIndex}-${timeIndex}-alt-solo`] ||
                                !matchSelections[`${eventIndex}-${timeIndex}-alt-team1`] ||
                                !matchSelections[`${eventIndex}-${timeIndex}-alt-team2`]
                              }
                              onClick={() => {
                                const solo = matchSelections[`${eventIndex}-${timeIndex}-alt-solo`];
                                const team1 = matchSelections[`${eventIndex}-${timeIndex}-alt-team1`];
                                const team2 = matchSelections[`${eventIndex}-${timeIndex}-alt-team2`];
                                
                                if (solo && team1 && team2) {
                                  createMatch(event.courseName, round, 'alternating', [solo, team1, team2], time);
                                }
                              }}
                            >
                              Create Alternating Match
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Championship Format */}
          {scheduleData.find(event => event.specialFormat?.type === 'Championship') && (
            <div className="championship-section mb-8">
              <h2 className="text-3xl font-semibold mb-6 text-center text-success">Championship Format Setup</h2>
              
              <div className="text-center">
                <button
                  className="btn btn-warning btn-lg"
                  onClick={() => {
                    setSelectedEvent(scheduleData.find(event => event.specialFormat?.type === 'Championship'));
                    setShowChampionshipModal(true);
                  }}
                >
                  Setup Championship Format
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Championship Format Modal */}
      <Modal show={showChampionshipModal} onHide={() => setShowChampionshipModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Championship Format Setup</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedEvent && (
            <ChampionshipFormat
              event={selectedEvent}
              players={players}
              onSave={async (formatData) => {
                const db = getFirestore();
                try {
                  await setDoc(doc(db, 'specialFormats', '2025-schedule'), {
                    [selectedEvent.date]: formatData
                  }, { merge: true });
                  
                  // Create championship live match
                  const championshipMatch = {
                    id: `${selectedEvent.date}-championship`,
                    courseName: selectedEvent.courseName,
                    date: selectedEvent.date,
                    matchType: 'championship',
                    status: 'not_started',
                    lastUpdate: new Date(),
                    formatData: formatData
                  };
                  
                  await setDoc(doc(db, 'liveMatches', '2025'), {
                    [`${selectedEvent.date}-championship`]: championshipMatch
                  }, { merge: true });
                  
                  setShowChampionshipModal(false);
                } catch (error) {
                  console.error('Error saving championship format:', error);
                }
              }}
            />
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Teams;