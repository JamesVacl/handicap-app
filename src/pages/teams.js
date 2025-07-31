import { useState, useEffect, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/router';
import { Navbar, Nav, Container, Button, Form } from 'react-bootstrap';
import { getTeams, getScores, addTeam, updateTeam, getPlayerHandicaps, setupTeamMatches } from '../firebase';
import NavigationMenu from '../components/NavigationMenu';
import 'bootstrap/dist/css/bootstrap.min.css'; 
import Image from 'next/image'; // Import the Image component from Next.js
import { getFirestore, setDoc, doc, onSnapshot } from 'firebase/firestore';

const Teams = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [groups, setGroups] = useState({
    morning: [
      { name: 'Group 1', players: [], selectedMatch: null },
      { name: 'Group 2', players: [], selectedMatch: null },
      { name: 'Group 3', players: [], selectedMatch: null }
    ],
    afternoon: [
      { name: 'Group 1', players: [], selectedMatch: null },
      { name: 'Group 2', players: [], selectedMatch: null },
      { name: 'Group 3', players: [], selectedMatch: null }
    ],
    sunday: [
      { name: 'Group 1', players: [], selectedMatch: null },
      { name: 'Group 2', players: [], selectedMatch: null },
      { name: 'Group 3', players: [], selectedMatch: null }
    ]
  });
  const [teamSelections, setTeamSelections] = useState({
    goldenBoys: { morning: null, sunday: null },
    puttPirates: { afternoon: null }
  });
  const [matches, setMatches] = useState({});
  const [scheduleData, setScheduleData] = useState([]);
  const [teamMatches, setTeamMatches] = useState({});
  const [selectionAssignments, setSelectionAssignments] = useState({
    '2025-08-09': {
      '7:30': 'Golden Boys Selection',
      '7:40': 'Putt Pirates Selection',
      '7:50': 'Golden Boys Selection'
    },
    '2025-08-10': {
      '10:10': 'Golden Boys Selection',
      '10:20': 'Putt Pirates Selection',
      '10:30': 'Golden Boys Selection'
    }
  });
  const [loading, setLoading] = useState(true);
  const [matchSelections, setMatchSelections] = useState({});
  const [roundSelections, setRoundSelections] = useState({
    '2025-08-09-morning': {
      selectingTeam: 'Golden Boys',
      mainMatch: null,
      alternatingMatches: []
    },
    '2025-08-09-afternoon': {
      selectingTeam: 'Putt Pirates',
      mainMatch: null,
      alternatingMatches: []
    },
    '2025-08-10': {
      selectingTeam: 'Golden Boys',
      mainMatch: null,
      alternatingMatches: []
    }
  });
  const [selectedTeeTime, setSelectedTeeTime] = useState(null);
  const [holeAssignments, setHoleAssignments] = useState({});
  const [startingPlayer, setStartingPlayer] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthenticated(true);
      } else {
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (authenticated) {
      const db = getFirestore();
      
      // Combine all Firebase listeners into one useEffect
      const listeners = [];
      
      // 1. Teams and Players data
      const teamsPromise = getTeams().then(teamsData => setTeams(teamsData));
      const playersPromise = getPlayerHandicaps().then(playerHandicaps => setPlayers(playerHandicaps));
      
      // 2. Selections listener
      const selectionsRef = doc(db, 'teamMatches', 'selections-2025');
      const selectionsUnsubscribe = onSnapshot(selectionsRef, (doc) => {
        if (doc.exists()) {
          setSelectionAssignments(doc.data());
        }
      });
      listeners.push(selectionsUnsubscribe);

      // 3. Team matches listener
      const teamMatchesRef = doc(db, 'teamMatches', '2025');
      const matchesUnsubscribe = onSnapshot(teamMatchesRef, (doc) => {
        if (doc.exists()) {
          setTeamMatches(doc.data());
        }
      });
      listeners.push(matchesUnsubscribe);

      // Initialize static schedule data immediately
      setScheduleData([
        {
          date: '2025-08-09',
          courseName: 'Treetops (Smith Signature)',
          teeTimes: ['7:30', '7:40', '7:50'],
          notes: 'Blue tees - Team Match Format',
          format: `Each group of 3 players will have one 1v1 match and one alternating match. 
                  Golden Boys select matches for morning round and Sunday round. 
                  Putt Pirates select matches for afternoon round.`
        },
        {
          date: '2025-08-10',
          courseName: 'Belvedere Golf Club',
          teeTimes: ['10:10', '10:20', '10:30'],
          notes: 'White tees - Team Match Format - Final Round',
          format: 'Any ties from Saturday matches will be settled at Threetops'
        }
      ]);

      // Cleanup function
      return () => {
        listeners.forEach(unsubscribe => unsubscribe());
        setSelectedTeeTime(null);
      };
    }
  }, [authenticated]);

  const calculateTeamAverage = useMemo(() => {
    return (teamPlayers) => {
      if (!teamPlayers.length) return 0;
      const sum = teamPlayers.reduce((acc, player) => acc + player.handicap, 0);
      return (sum / teamPlayers.length).toFixed(1);
    };
  }, []);

  const handleAddPlayer = async (teamId, playerName) => {
    const player = players.find(p => p.name === playerName);
    if (!player) return;

    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const updatedPlayers = [...team.players, player];
    const averageHandicap = calculateTeamAverage(updatedPlayers);

    await updateTeam(teamId, {
      players: updatedPlayers,
      averageHandicap
    });

    // Refresh teams data
    const teamsData = await getTeams();
    setTeams(teamsData);
  };

  const handleGroupAssignment = async (eventIndex, timeIndex, selectedPlayers) => {
    const db = getFirestore();
    const matchKey = `${eventIndex}-${timeIndex}`;
    
    try {
      await setDoc(doc(db, 'teamMatches', '2025'), {
        [matchKey]: {
          players: selectedPlayers,
          eventDate: scheduleData[eventIndex].date,
          courseName: scheduleData[eventIndex].courseName,
          teeTime: scheduleData[eventIndex].teeTimes[timeIndex]
        }
      }, { merge: true });
    } catch (error) {
      console.error('Error saving group assignment:', error);
    }
  };

  const handleMatchSelection = async (team, round, matchData) => {
    const updatedSelections = { ...teamSelections };
    updatedSelections[team][round] = matchData;
    setTeamSelections(updatedSelections);

    const db = getFirestore();
    await setDoc(doc(db, 'teamMatches', '2025'), {
      teamSelections: updatedSelections
    }, { merge: true });
  };

  const handleMatchSetup = async (eventIndex, timeIndex, player1, player2) => {
    const matchKey = `${eventIndex}-${timeIndex}`;
    const allPlayers = teamMatches[matchKey]?.players || [];
    
    // Find the third player (the one not selected for 1v1)
    const alternatingPlayer = allPlayers.find(p => p !== player1 && p !== player2);
    
    const updatedMatches = {
      ...matches,
      [matchKey]: {
        mainMatch: {
          player1,
          player2,
          type: '1v1'
        },
        alternatingMatch: {
          singlePlayer: alternatingPlayer,
          type: 'alternating'
        }
      }
    };

    setMatches(updatedMatches);

    const db = getFirestore();
    try {
      await setDoc(doc(db, 'teamMatches', '2025'), {
        matches: updatedMatches
      }, { merge: true });
    } catch (error) {
      console.error('Error saving match setup:', error);
    }
  };

  const handleUpdateSelection = async (date, time, team) => {
    const db = getFirestore();
    try {
      await setDoc(doc(db, 'teamMatches', 'selections-2025'), {
        [date]: {
          ...selectionAssignments[date],
          [time]: {
            team: team,
            timestamp: new Date().toISOString()
          }
        }
      }, { merge: true });
    } catch (error) {
      console.error('Error updating selection:', error);
    }
  };

  const getRound = (time) => {
    const hour = parseInt(time.split(':')[0]);
    if (hour < 12) {
      return 'morning';
    } else if (hour < 17) {
      return 'afternoon';
    } else {
      return 'evening';
    }
  };

  const handleRoundMatchSetup = async (date, timeIndex, players, holeAssignments = null) => {
    const time = scheduleData.find(e => e.date === date)?.teeTimes[timeIndex];
    const round = getRound(time);
    const roundKey = `${date}-${round}`;
    
    const updatedSelections = { ...roundSelections };

    if (timeIndex === selectedTeeTime) {
      updatedSelections[roundKey].mainMatch = {
        teeTimeIndex: timeIndex,
        player1: players[0],
        player2: players[1],
        sittingOut: players[2]
      };
    } else {
      updatedSelections[roundKey].alternatingMatches.push({
        teeTimeIndex: timeIndex,
        soloPlayer: players[0],
        team2Players: players.slice(1),
        holeAssignments: holeAssignments
      });
    }

    setRoundSelections(updatedSelections);

    const db = getFirestore();
    try {
      await setDoc(doc(db, 'teamMatches', '2025-rounds'), {
        [roundKey]: updatedSelections[roundKey]
      }, { merge: true });
    } catch (error) {
      console.error('Error saving round setup:', error);
    }
  };

  return (
    <div className="app-wrapper">
      {authenticated && <NavigationMenu />}
      <div className="home-container">
        <div className="overlay"></div>
        <div className="content">
          <h1 className="text-4xl font-semibold mb-8 cursive-font text-center">Teams</h1>
          
          {/* Show teams section as soon as teams data is available */}
          {teams.length > 0 && (
            <div className="teams-section">
              {teams.map(team => (
                <div key={team.id} className="team-section mb-4">
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
                      <h2 className="text-2xl font-bold">{team.name}</h2>
                      <p className="text-xl text-success">
                        Team Average: {team.averageHandicap || 0}
                      </p>
                    </div>
                  </div>
                  
                  <div className="players-list my-3">
                    {team.players?.map(player => (
                      <div key={player.name} className="player-item">
                        {player.name} - Handicap: {player.handicap}
                      </div>
                    ))}
                  </div>

                  <Form className="mt-3">
                    <Form.Group className="d-flex gap-2">
                      <Form.Select 
                        onChange={(e) => setSelectedPlayer(e.target.value)}
                        className="w-75"
                        >
                        <option value="">Select Player</option>
                        {players.map(player => (
                          <option key={player.name} value={player.name}>
                            {player.name} ({player.handicap})
                          </option>
                        ))}
                      </Form.Select>
                      <Button 
                        variant="success"
                        onClick={() => handleAddPlayer(team.id, selectedPlayer)}
                      >
                        Add Player
                      </Button>
                    </Form.Group>
                  </Form>
                </div>
              ))}
            </div>
          )}
          
          {/* Show matches section as soon as schedule data is available */}
          {scheduleData.length > 0 && (
            <div className="team-matches mt-8 pt-8 border-top">
              <h2 className="text-3xl font-semibold mb-6 text-center">Team Matches</h2>
              
              {console.log('Schedule Data:', scheduleData)}
              {scheduleData.map((event, eventIndex) => (
                <div key={eventIndex} className="event-section mb-6">
                  <div className="event-header mb-4">
                    <h3 className="text-2xl text-success">{event.courseName}</h3>
                    <p className="text-muted">{event.date}</p>
                    {event.notes && (
                      <p className="text-gray-600 italic">{event.notes}</p>
                    )}
                    {event.format && (
                      <div className="format-info mt-2 p-3 bg-light border rounded">
                        <h5 className="mb-2">Format:</h5>
                        <p className="mb-0">{event.format}</p>
                      </div>
                    )}
                  </div>

                  <div className="tee-times">
                    {event.teeTimes.map((time, timeIndex) => (
                      <div key={timeIndex} className="tee-time-slot mb-4 p-3 border rounded bg-light">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h4 className="text-xl mb-0">{time}</h4>
                          <Form.Group className="d-flex align-items-center gap-2">
                            <Form.Select
                              size="sm"
                              value={selectionAssignments[event.date]?.[time]?.team || ''}
                              onChange={(e) => handleUpdateSelection(event.date, time, e.target.value)}
                              style={{ width: 'auto' }}
                            >
                              <option value="">Select Team</option>
                              <option value="Golden Boys">Golden Boys</option>
                              <option value="Putt Pirates">Putt Pirates</option>
                            </Form.Select>
                            <small className="text-muted">Selection</small>
                          </Form.Group>
                        </div>

                        <div className="group-assignment mb-3 p-3 border rounded">
                          <h5 className="mb-3">Group Assignment</h5>
                          <div className="selected-players mb-2">
                            {teamMatches[`${eventIndex}-${timeIndex}`]?.players?.map((player, idx) => (
                              <div key={idx} className="player-badge d-inline-block me-2 mb-2 p-2 bg-success text-white rounded">
                                {player}
                                <Button 
                                  variant="link" 
                                  className="text-white ms-2 p-0" 
                                  onClick={() => {
                                    const updatedPlayers = teamMatches[`${eventIndex}-${timeIndex}`].players.filter(p => p !== player);
                                    handleGroupAssignment(eventIndex, timeIndex, updatedPlayers);
                                  }}
                                >
                                  ×
                                </Button>
                              </div>
                            ))}
                          </div>
                          
                          <Form.Group>
                            <Form.Select 
                              value=""
                              onChange={(e) => {
                                if (!e.target.value) return;
                                const currentPlayers = teamMatches[`${eventIndex}-${timeIndex}`]?.players || [];
                                if (currentPlayers.length >= 3) {
                                  alert('Maximum 3 players allowed per group');
                                  return;
                                }
                                handleGroupAssignment(eventIndex, timeIndex, [...currentPlayers, e.target.value]);
                              }}
                            >
                              <option value="">Add Player to Group</option>
                              {players
                                .filter(player => !teamMatches[`${eventIndex}-${timeIndex}`]?.players?.includes(player.name))
                                .map(player => (
                                  <option key={player.name} value={player.name}>
                                    {player.name} ({player.handicap})
                                  </option>
                                ))}
                            </Form.Select>
                          </Form.Group>
                        </div>

                        <div className="round-setup p-3 border rounded mt-3">
                          <h5 className="mb-3">Round Setup - {event.date}</h5>
                          
                          {/* Only show tee time selection if no 1v1 match is set for this round */}
                          {!roundSelections[`${event.date}-${getRound(time)}`]?.mainMatch && (
                            <div className="mb-4">
                              <h6>Step 1: Select Tee Time for 1v1 Match</h6>
                              <div className="d-flex gap-3">
                                {event.teeTimes.map((teeTime, idx) => (
                                  <Button
                                    key={idx}
                                    variant={selectedTeeTime === idx ? 'success' : 'outline-success'}
                                    onClick={() => setSelectedTeeTime(idx)}
                                    disabled={roundSelections[`${event.date}-${getRound(teeTime)}`]?.mainMatch !== null}
                                  >
                                    {teeTime}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Show match setup interface */}
                          {teamMatches[`${eventIndex}-${timeIndex}`]?.players?.length === 3 && (
                            <div className="match-setup mt-3">
                              {timeIndex === selectedTeeTime ? (
                                // 1v1 Match Setup
                                <div>
                                  <h6>1v1 Match Setup</h6>
                                  <div className="d-flex gap-2 mt-2">
                                    {teamMatches[`${eventIndex}-${timeIndex}`].players.map((player, idx) => (
                                      <Button
                                        key={idx}
                                        variant={
                                          matchSelections[`${eventIndex}-${timeIndex}`]?.players?.includes(player)
                                            ? 'success'
                                            : 'outline-success'
                                        }
                                        onClick={() => {
                                          const current = matchSelections[`${eventIndex}-${timeIndex}`]?.players || [];
                                          if (current.includes(player)) {
                                            setMatchSelections({
                                              ...matchSelections,
                                              [`${eventIndex}-${timeIndex}`]: {
                                                players: current.filter(p => p !== player)
                                              }
                                            });
                                          } else if (current.length < 2) {
                                            setMatchSelections({
                                              ...matchSelections,
                                              [`${eventIndex}-${timeIndex}`]: {
                                                players: [...current, player]
                                              }
                                            });
                                          }
                                        }}
                                      >
                                        {player}
                                      </Button>
                                    ))}
                                  </div>
                                  {matchSelections[`${eventIndex}-${timeIndex}`]?.players?.length === 2 && (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      className="mt-2"
                                      onClick={() => handleRoundMatchSetup(
                                        event.date,
                                        timeIndex,
                                        teamMatches[`${eventIndex}-${timeIndex}`].players
                                      )}
                                    >
                                      Confirm 1v1 Match
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                // Alternating Match Setup (only show after 1v1 is set)
                                roundSelections[`${event.date}-${getRound(time)}`]?.mainMatch && (
                                  <div>
                                    <h6>Alternating Match Setup</h6>
                                    <p className="text-muted small">1. Select the solo player who will alternate against the other two players</p>
                                    <div className="d-flex gap-2 mt-2 mb-3">
                                      {teamMatches[`${eventIndex}-${timeIndex}`].players.map((player, idx) => (
                                        <Button
                                          key={idx}
                                          variant={
                                            matchSelections[`${eventIndex}-${timeIndex}`]?.soloPlayer === player
                                              ? 'success'
                                              : 'outline-success'
                                          }
                                          onClick={() => {
                                            setMatchSelections({
                                              ...matchSelections,
                                              [`${eventIndex}-${timeIndex}`]: {
                                                soloPlayer: player,
                                                team2Players: teamMatches[`${eventIndex}-${timeIndex}`].players.filter(p => p !== player)
                                              }
                                            });
                                          }}
                                        >
                                          {player}
                                        </Button>
                                      ))}
                                    </div>

                                    {matchSelections[`${eventIndex}-${timeIndex}`]?.soloPlayer && (
                                      <>
                                        <p className="text-muted small mt-4">2. Select which opponent starts on hole 1</p>
                                        <div className="d-flex gap-2 mt-2 mb-3">
                                          {matchSelections[`${eventIndex}-${timeIndex}`].team2Players.map((player, idx) => (
                                            <Button
                                              key={idx}
                                              variant={startingPlayer === player ? 'success' : 'outline-success'}
                                              onClick={() => setStartingPlayer(player)}
                                            >
                                              {player}
                                            </Button>
                                          ))}
                                        </div>

                                        {startingPlayer && (
                                          <>
                                            <Button
                                              variant="primary"
                                              size="sm"
                                              className="mt-3"
                                              onClick={() => {
                                                const soloPlayer = matchSelections[`${eventIndex}-${timeIndex}`].soloPlayer;
                                                const otherPlayer = matchSelections[`${eventIndex}-${timeIndex}`].team2Players.find(p => p !== startingPlayer);
                                                
                                                // Create hole assignments
                                                const holes = {};
                                                for (let i = 1; i <= 18; i++) {
                                                  holes[i] = i % 2 === 1 ? startingPlayer : otherPlayer;
                                                }
                                                
                                                setHoleAssignments({
                                                  ...holeAssignments,
                                                  [`${eventIndex}-${timeIndex}`]: holes
                                                });

                                                handleRoundMatchSetup(
                                                  event.date,
                                                  timeIndex,
                                                  [soloPlayer, startingPlayer, otherPlayer],
                                                  holes
                                                );
                                              }}
                                            >
                                              Confirm Alternating Match
                                            </Button>

                                            <div className="hole-assignments mt-3 p-3 bg-light rounded">
                                              <h6>Preview Hole Assignments vs {matchSelections[`${eventIndex}-${timeIndex}`]?.soloPlayer}:</h6>
                                              <div className="d-flex flex-wrap gap-2 mt-2">
                                                {[...Array(18)].map((_, i) => (
                                                  <div key={i} className="text-center">
                                                    <small className="d-block text-muted">Hole {i + 1}</small>
                                                    <span className="badge bg-success">
                                                      {i % 2 === 0 ? startingPlayer : matchSelections[`${eventIndex}-${timeIndex}`].team2Players.find(p => p !== startingPlayer)}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          )}

                          {/* Show current match setup if exists */}
                          {roundSelections[`${event.date}-${getRound(time)}`]?.mainMatch && 
                          timeIndex === roundSelections[`${event.date}-${getRound(time)}`]?.mainMatch?.teeTimeIndex && (
                            <div className="match-display mt-3 p-2 bg-light rounded">
                              <strong>1v1 Match:</strong> {roundSelections[`${event.date}-${getRound(time)}`].mainMatch.player1} vs{' '}
                              {roundSelections[`${event.date}-${getRound(time)}`].mainMatch.player2}
                              <br />
                              <small className="text-muted">Sitting out: {roundSelections[`${event.date}-${getRound(time)}`].mainMatch.sittingOut}</small>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Show loading state if nothing is available yet */}
          {loading && !teams.length && !scheduleData.length && (
            <div className="text-center">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Teams;