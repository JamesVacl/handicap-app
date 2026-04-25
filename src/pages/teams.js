import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Badge } from 'react-bootstrap';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, setDoc, doc, onSnapshot, deleteField } from 'firebase/firestore';
import { getTeams, getPlayers, getPlayerHandicaps, updateTeam } from '../firebase';
import NavigationMenu from '../components/NavigationMenu';
import FloatingNavigation from '../components/FloatingNavigation';
import 'bootstrap/dist/css/bootstrap.min.css';
import Image from 'next/image';

const Teams = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [scheduledMatches, setScheduledMatches] = useState({});
  const [isRefreshingHandicaps, setIsRefreshingHandicaps] = useState(false);
  const [lastHandicapUpdate, setLastHandicapUpdate] = useState(null);
  const [teamRosterSelections, setTeamRosterSelections] = useState({});
  const [savingTeamId, setSavingTeamId] = useState(null);
  const [handicapByPlayerName, setHandicapByPlayerName] = useState({});

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
          const playerHandicaps = await getPlayerHandicaps();
          const handicapMap = Object.fromEntries(
            playerHandicaps.map((entry) => [entry.name, entry.handicap])
          );
          setTeams(teamsData);
          setPlayers(playersData);
          setHandicapByPlayerName(handicapMap);
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
      const handicapMap = Object.fromEntries(
        playerHandicaps.map((entry) => [entry.name, entry.handicap])
      );
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
      
      await Promise.all(
        updatedTeams.map((team) =>
          updateTeam(team.id, {
            players: team.players || [],
            averageHandicap: team.averageHandicap || 0
          })
        )
      );

      console.log('Updated teams:', updatedTeams);
      setTeams(updatedTeams);
      setHandicapByPlayerName(handicapMap);
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

  const getAssignedPlayerNames = () => {
    const assigned = new Set();
    teams.forEach((team) => {
      (team.players || []).forEach((player) => {
        if (player?.name) assigned.add(player.name);
      });
    });
    return assigned;
  };

  const getAvailablePlayersForTeam = (team) => {
    const assignedPlayerNames = getAssignedPlayerNames();
    const teamPlayerNames = new Set((team.players || []).map((player) => player.name));

    return players
      .filter((player) => {
        if (teamPlayerNames.has(player.name)) return false;
        return !assignedPlayerNames.has(player.name);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const handleAddPlayerToTeam = async (team) => {
    if (!authenticated || !team?.id) return;

    const selectedPlayerName = teamRosterSelections[team.id];
    if (!selectedPlayerName) return;

    const existingTeam = teams.find((t) =>
      (t.players || []).some((player) => player.name === selectedPlayerName)
    );

    if (existingTeam) {
      alert(`${selectedPlayerName} is already assigned to ${existingTeam.name}.`);
      return;
    }

    const selectedPlayer = players.find((player) => player.name === selectedPlayerName);
    if (!selectedPlayer) {
      alert('Selected player not found.');
      return;
    }

    const updatedPlayers = [
      ...(team.players || []),
      { name: selectedPlayer.name, handicap: handicapByPlayerName[selectedPlayer.name] ?? 0 }
    ];

    const averageHandicap = updatedPlayers.length
      ? parseFloat((updatedPlayers.reduce((acc, p) => acc + (p.handicap || 0), 0) / updatedPlayers.length).toFixed(1))
      : 0;

    try {
      setSavingTeamId(team.id);
      await updateTeam(team.id, { players: updatedPlayers, averageHandicap });
      setTeams((prevTeams) =>
        prevTeams.map((t) => (t.id === team.id ? { ...t, players: updatedPlayers, averageHandicap } : t))
      );
      setTeamRosterSelections((prev) => ({ ...prev, [team.id]: '' }));
    } catch (error) {
      console.error('Error adding player to team:', error);
      alert('Unable to add player right now. Please try again.');
    } finally {
      setSavingTeamId(null);
    }
  };

  const handleRemovePlayerFromTeam = async (team, playerName) => {
    if (!authenticated || !team?.id || !playerName) return;

    const updatedPlayers = (team.players || []).filter((player) => player.name !== playerName);
    const averageHandicap = updatedPlayers.length
      ? parseFloat((updatedPlayers.reduce((acc, p) => acc + (p.handicap || 0), 0) / updatedPlayers.length).toFixed(1))
      : 0;

    try {
      setSavingTeamId(team.id);
      await updateTeam(team.id, { players: updatedPlayers, averageHandicap });
      setTeams((prevTeams) =>
        prevTeams.map((t) => (t.id === team.id ? { ...t, players: updatedPlayers, averageHandicap } : t))
      );
    } catch (error) {
      console.error('Error removing player from team:', error);
      alert('Unable to remove player right now. Please try again.');
    } finally {
      setSavingTeamId(null);
    }
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
                        <div key={player.name} className="player-item d-flex justify-content-between align-items-center gap-2">
                          <span>{player.name} - Handicap: {player.handicap}</span>
                          {authenticated && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleRemovePlayerFromTeam(team, player.name)}
                              disabled={savingTeamId === team.id}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    {authenticated && (
                      <div className="d-flex gap-2 align-items-center">
                        <Form.Select
                          value={teamRosterSelections[team.id] || ''}
                          onChange={(e) =>
                            setTeamRosterSelections((prev) => ({
                              ...prev,
                              [team.id]: e.target.value
                            }))
                          }
                          disabled={savingTeamId === team.id}
                        >
                          <option value="">-- Add player to team --</option>
                          {getAvailablePlayersForTeam(team).map((player) => (
                            <option key={player.id || player.name} value={player.name}>
                              {player.name}
                            </option>
                          ))}
                        </Form.Select>
                        <Button
                          variant="outline-success"
                          onClick={() => handleAddPlayerToTeam(team)}
                          disabled={!teamRosterSelections[team.id] || savingTeamId === team.id}
                        >
                          Add Player
                        </Button>
                      </div>
                    )}
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

        </div>
      </div>
    </div>
  );
};

export default Teams;