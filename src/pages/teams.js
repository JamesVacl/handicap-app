import { useState, useEffect, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Navbar, Nav, Container, Button, Form } from 'react-bootstrap';
import { getTeams, getScores, addTeam, updateTeam, getPlayerHandicaps, setupTeamMatches } from '../firebase';
import NavigationMenu from '../components/NavigationMenu';
import FloatingNavigation from '../components/FloatingNavigation';
import ChampionshipFormat from '../components/ChampionshipFormat';
import 'bootstrap/dist/css/bootstrap.min.css'; 
import Image from 'next/image';
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
      '7:50': 'Golden Boys Selection',
      '14:53': 'TBD Selection',
      '15:04': 'TBD Selection',
      '15:15': 'TBD Selection'
    },
    '2025-08-10': {
      '10:10': 'Golden Boys Selection',
      '10:20': 'Putt Pirates Selection',
      '10:30': 'Golden Boys Selection',
      '18:40': 'TBD Selection',
      '18:50': 'TBD Selection',
      '19:00': 'TBD Selection'
    },
    '2025-08-11': {
      '9:20': 'TBD Selection',
      '9:31': 'TBD Selection',
      '9:42': 'TBD Selection'
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
    '2025-08-10-morning': {
      selectingTeam: 'Golden Boys',
      mainMatch: null,
      alternatingMatches: []
    },
    '2025-08-10-evening': {
      selectingTeam: 'TBD',
      mainMatch: null,
      alternatingMatches: []
    },
    '2025-08-11-morning': {
      selectingTeam: 'TBD',
      mainMatch: null,
      alternatingMatches: []
    }
  });
  const [selectedTeeTimes, setSelectedTeeTimes] = useState({});
  const [holeAssignments, setHoleAssignments] = useState({});
  const [startingPlayer, setStartingPlayer] = useState(null);
  const [persistentMatches, setPersistentMatches] = useState({});
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthenticated(true);
      } else {
        // Allow viewing the page without authentication for persistent matches
        setAuthenticated(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const db = getFirestore();
    
    // Combine all Firebase listeners into one useEffect
    const listeners = [];
    
    // 1. Teams and Players data (only for authenticated users)
    if (authenticated) {
      const teamsPromise = getTeams().then(teamsData => setTeams(teamsData));
      const playersPromise = getPlayerHandicaps().then(playerHandicaps => setPlayers(playerHandicaps));
    }
    
    // 2. Selections listener (only for authenticated users)
    if (authenticated) {
      const selectionsRef = doc(db, 'teamMatches', 'selections-2025');
      const selectionsUnsubscribe = onSnapshot(selectionsRef, (doc) => {
        if (doc.exists()) {
          setSelectionAssignments(doc.data());
        }
      });
      listeners.push(selectionsUnsubscribe);

      // 3. Team matches listener (only for authenticated users)
      const teamMatchesRef = doc(db, 'teamMatches', '2025');
      const matchesUnsubscribe = onSnapshot(teamMatchesRef, (doc) => {
        if (doc.exists()) {
          setTeamMatches(doc.data());
        }
      });
      listeners.push(matchesUnsubscribe);
    }

    // 4. Round selections listener for persistent display (for all users)
    const roundSelectionsRef = doc(db, 'teamMatches', '2025-rounds');
    const roundSelectionsUnsubscribe = onSnapshot(roundSelectionsRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setPersistentMatches(data);
        // Also update the local state for editing (only for authenticated users)
        if (authenticated) {
          setRoundSelections(data);
        }
      }
    });
    listeners.push(roundSelectionsUnsubscribe);

    // Initialize static schedule data immediately (for all users)
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
        date: '2025-08-09',
        courseName: 'Treetops (Jones Masterpiece)',
        teeTimes: ['14:53', '15:04', '15:15'],
        notes: 'Blue tees - Team Match Format',
        format: `Each group of 3 players will have one 1v1 match and one alternating match.`
      },
      {
        date: '2025-08-10',
        courseName: 'Belvedere Golf Club',
        teeTimes: ['10:10', '10:20', '10:30'],
        notes: 'White tees - Team Match Format - Final Round',
        format: 'Each group of 3 players will have one 1v1 match and one alternating match.'
      },
      {
        date: '2025-08-10',
        courseName: 'Threetops',
        teeTimes: ['18:40', '18:50', '19:00'],
        notes: 'socks off time, par 3 course',
        format: `Any ties will be determined at the Threetops`
      },
      {
        date: '2025-08-11',
        courseName: 'Forest Dunes',
        teeTimes: ['9:20', '9:31', '9:42'],
        notes: 'Championship Matchplay - Championship Format',
        format: 'Championship format with team vs team hole assignments',
        specialFormat: {
          type: 'Championship',
          teams: {
            team1: {
              name: 'Putt Pirates',
              players: [],
              holeAssignments: {}
            },
            team2: {
              name: 'Golden Boys',
              players: [],
              holeAssignments: {}
            }
          }
        }
      }
    ]);

    // Cleanup function
    return () => {
      listeners.forEach(unsubscribe => unsubscribe());
      setSelectedTeeTimes({});
    };
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
    } else if (hour < 18) {
      return 'afternoon';
    } else {
      return 'evening';
    }
  };

    const handleRoundMatchSetup = async (date, timeIndex, selectedPlayers, holeAssignments = null) => {
    const time = scheduleData.find(e => e.date === date)?.teeTimes[timeIndex];
    const round = getRound(time);
    const roundKey = `${date}-${round}`;
    const event = scheduleData.find(e => e.date === date);
    
    const updatedSelections = { ...roundSelections };

    // Get the third player (the one not selected for 1v1)
    const allPlayers = teamMatches[`${scheduleData.findIndex(e => e.date === date)}-${timeIndex}`]?.players || [];
    const sittingOut = allPlayers.find(p => !selectedPlayers.includes(p));

    // Create 1v1 match with the 2 selected players
    updatedSelections[roundKey].mainMatch = {
      teeTimeIndex: timeIndex,
      player1: selectedPlayers[0],
      player2: selectedPlayers[1],
      sittingOut: sittingOut
    };

    setRoundSelections(updatedSelections);

    const db = getFirestore();
    try {
      // Save to team matches
      await setDoc(doc(db, 'teamMatches', '2025-rounds'), {
        [roundKey]: updatedSelections[roundKey]
      }, { merge: true });

      // Create live match for results page
      const matchId = `${date}-${round}-${timeIndex}`;
      const liveMatch = {
        id: matchId,
        courseName: event?.courseName || 'Unknown Course',
        date: date,
        teeTime: time,
        round: round,
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

      // Always create 1v1 match when this function is called
      liveMatch.player1 = selectedPlayers[0];
      liveMatch.player2 = selectedPlayers[1];
      liveMatch.matchType = '1v1';
      liveMatch.sittingOut = sittingOut;
      
      // Add team affiliations for 1v1 matches
      const player1Team = teams.find(team => team.players?.some(p => p.name === selectedPlayers[0]))?.name || 'Unknown';
      const player2Team = teams.find(team => team.players?.some(p => p.name === selectedPlayers[1]))?.name || 'Unknown';
      console.log('1v1 Match Team Assignment:', { player1: selectedPlayers[0], player1Team, player2: selectedPlayers[1], player2Team, teams });
      liveMatch.player1Team = player1Team;
      liveMatch.player2Team = player2Team;

      await setDoc(doc(db, 'liveMatches', '2025'), {
        [matchId]: liveMatch
      }, { merge: true });

    } catch (error) {
      console.error('Error saving round setup:', error);
    }
  };

  const handleAlternatingMatchSetup = async (date, timeIndex, players, holeAssignments = null) => {
    const time = scheduleData.find(e => e.date === date)?.teeTimes[timeIndex];
    const round = getRound(time);
    const roundKey = `${date}-${round}`;
    const event = scheduleData.find(e => e.date === date);
    
    const updatedSelections = { ...roundSelections };

    // Create alternating match
    updatedSelections[roundKey].alternatingMatches.push({
      teeTimeIndex: timeIndex,
      soloPlayer: players[0],
      team2Players: players.slice(1),
      holeAssignments: holeAssignments
    });

    setRoundSelections(updatedSelections);

    const db = getFirestore();
    try {
      // Save to team matches
      await setDoc(doc(db, 'teamMatches', '2025-rounds'), {
        [roundKey]: updatedSelections[roundKey]
      }, { merge: true });

      // Create live match for results page
      const matchId = `${date}-${round}-${timeIndex}`;
      const liveMatch = {
        id: matchId,
        courseName: event?.courseName || 'Unknown Course',
        date: date,
        teeTime: time,
        round: round,
        status: 'not_started',
        lastUpdate: new Date(),
        currentScore: {
          player1Score: 0,
          player2Score: 0,
          holesPlayed: 0,
          holeResults: {},
          recentHoles: []
        },
        // Alternating Match
        player1: players[0], // solo player
        player2: players.slice(1).join(' & '), // team players
        matchType: 'alternating',
        soloPlayer: players[0],
        team2Players: players.slice(1),
        holeAssignments: holeAssignments
      };
      
      // Add team affiliations for alternating matches
      const soloPlayerTeam = teams.find(team => team.players?.some(p => p.name === players[0]))?.name || 'Unknown';
      const team2PlayerTeams = players.slice(1).map(player => {
        const team = teams.find(team => team.players?.some(p => p.name === player));
        return team?.name || 'Unknown';
      });
      console.log('Alternating Match Team Assignment:', { soloPlayer: players[0], soloPlayerTeam, team2Players: players.slice(1), team2PlayerTeams, teams });
      liveMatch.soloPlayerTeam = soloPlayerTeam;
      liveMatch.team2PlayerTeams = team2PlayerTeams;

      await setDoc(doc(db, 'liveMatches', '2025'), {
        [matchId]: liveMatch
      }, { merge: true });

    } catch (error) {
      console.error('Error saving alternating match setup:', error);
    }
  };

  // Helper functions for formatting
  const formatDate = (dateString) => {
    // Handle date strings like "2025-08-09"
    if (dateString && dateString.includes('-')) {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month is 0-indexed
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
    // Fallback for other date formats
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
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

  return (
    <div>
      <Head>
        <title>Teams - Guyscorp</title>
        <meta name="description" content="Team match setup and management" />
      </Head>
      <div className="app-wrapper">
        {authenticated && <NavigationMenu />}
        <FloatingNavigation />
        <div className="home-container">
          <div className="overlay"></div>
          <div className="content">
            <h1 className="text-4xl font-semibold mb-8 cursive-font text-center">Teams</h1>
          
            {/* Persistent Matches Display Section */}
            {Object.keys(persistentMatches).length > 0 && (
              <div className="persistent-matches-section mb-8 p-4 bg-light border rounded">
                <h2 className="text-3xl font-semibold mb-6 text-center text-success">Scheduled Matches</h2>
                
                {(() => {
                  // Group matches by course
                  const matchesByCourse = {};
                  
                  Object.entries(persistentMatches).forEach(([roundKey, roundData]) => {
                    const parts = roundKey.split('-');
                    const date = parts.slice(0, 3).join('-');
                    const round = parts.slice(3).join('-');
                    const event = scheduleData.find(e => e.date === date);
                    const courseName = event?.courseName || 'Unknown Course';
                    
                    if (!matchesByCourse[courseName]) {
                      matchesByCourse[courseName] = [];
                    }
                    
                    matchesByCourse[courseName].push({
                      roundKey,
                      roundData,
                      date,
                      round,
                      event
                    });
                  });
                  
                  return Object.entries(matchesByCourse).map(([courseName, courseMatches]) => (
                    <div key={courseName} className="course-matches mb-6">
                      <h3 className="text-2xl font-bold mb-4 text-success border-bottom pb-2">
                        {courseName}
                      </h3>
                      
                      {courseMatches.map(({ roundKey, roundData, date, round, event }) => (
                        <div key={roundKey} className="round-matches mb-4 p-3 border rounded">
                          <h4 className="text-lg font-semibold mb-3 text-muted">
                            {round.charAt(0).toUpperCase() + round.slice(1)} Round
                          </h4>
                      
                          {/* Main 1v1 Match */}
                          {roundData.mainMatch && (
                            <div className="main-match mb-3 p-3 bg-success text-white rounded">
                              <h4 className="mb-2">1v1 Match ({formatTeeTime(event?.teeTimes[roundData.mainMatch.teeTimeIndex])})</h4>
                              <div className="d-flex justify-content-between align-items-center">
                                <span className="text-lg">
                                  {roundData.mainMatch.player1} vs {roundData.mainMatch.player2}
                                </span>
                                <div className="d-flex align-items-center gap-2">
                                  <span className="badge bg-light text-dark">
                                    Sitting out: {roundData.mainMatch.sittingOut}
                                  </span>
                                  {authenticated && (
                                    <Button
                                      variant="link"
                                      className="text-white p-0 ms-2"
                                      onClick={async () => {
                                        const db = getFirestore();
                                        await setDoc(doc(db, 'teamMatches', '2025-rounds'), {
                                          [roundKey]: {
                                            ...roundData,
                                            mainMatch: null
                                          }
                                        }, { merge: true });
                                      }}
                                    >
                                      ×
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Alternating Matches */}
                          {roundData.alternatingMatches && roundData.alternatingMatches.length > 0 && (
                            <div className="alternating-matches">
                              <h4 className="mb-2">Alternating Matches</h4>
                              {roundData.alternatingMatches.map((altMatch, idx) => (
                                <div key={idx} className="alt-match mb-2 p-2 bg-success text-white rounded">
                                  <div className="d-flex justify-content-between align-items-center">
                                    <span>
                                      {altMatch.soloPlayer} vs {altMatch.team2Players.join(' & ')}
                                    </span>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="badge bg-light text-dark">
                                        {formatTeeTime(event?.teeTimes[altMatch.teeTimeIndex])}
                                      </span>
                                      {authenticated && (
                                        <Button
                                          variant="link"
                                          className="text-white p-0 ms-2"
                                          onClick={async () => {
                                            const db = getFirestore();
                                            const updatedAlternatingMatches = roundData.alternatingMatches.filter((_, matchIdx) => matchIdx !== idx);
                                            await setDoc(doc(db, 'teamMatches', '2025-rounds'), {
                                              [roundKey]: {
                                                ...roundData,
                                                alternatingMatches: updatedAlternatingMatches
                                              }
                                            }, { merge: true });
                                          }}
                                        >
                                          ×
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  {altMatch.holeAssignments && (
                                    <div className="mt-2">
                                      <small className="text-light">Hole Assignments:</small>
                                      <div className="d-flex flex-wrap gap-1 mt-1">
                                        {Object.entries(altMatch.holeAssignments).slice(0, 9).map(([hole, player]) => (
                                          <span key={hole} className="badge bg-light text-dark">
                                            H{hole}: {player}
                                          </span>
                                        ))}
                                        {Object.keys(altMatch.holeAssignments).length > 9 && (
                                          <span className="badge bg-light text-dark">...</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Championship Format Display */}
                          {event?.specialFormat?.type === 'Championship' && (
                            <div className="championship-format-display mt-3 p-3 bg-warning text-dark rounded">
                              <h4 className="mb-2">Championship Format</h4>
                              <p className="mb-2">Team vs Team hole assignments</p>
                              {authenticated && (
                                <ChampionshipFormat 
                                  event={event}
                                  players={players}
                                  onSave={async (formatData) => {
                                    const db = getFirestore();
                                    try {
                                      // Save championship format data
                                      await setDoc(doc(db, 'specialFormats', '2025-schedule'), {
                                        [event.date]: formatData
                                      }, { merge: true });

                                      // Create championship live match for results page
                                      const championshipMatch = {
                                        id: `${event.date}-championship`,
                                        courseName: event.courseName,
                                        date: event.date,
                                        matchType: 'championship',
                                        status: 'not_started',
                                        lastUpdate: new Date(),
                                        team1: {
                                          name: 'Putt Pirates',
                                          players: formatData.team1 || [],
                                          score: 0
                                        },
                                        team2: {
                                          name: 'Golden Boys',
                                          players: formatData.team2 || [],
                                          score: 0
                                        },
                                        holeAssignments: formatData.assignments || {},
                                        holeResults: {},
                                        currentScore: {
                                          team1Wins: 0,
                                          team2Wins: 0,
                                          holesPlayed: 0
                                        }
                                      };

                                      // Save to live matches collection
                                      await setDoc(doc(db, 'liveMatches', '2025'), {
                                        [`${event.date}-championship`]: championshipMatch
                                      }, { merge: true });

                                      alert('Championship format saved and live match created!');
                                    } catch (error) {
                                      console.error('Error saving championship format:', error);
                                      alert('Error saving championship format. Please try again.');
                                    }
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            )}
            
            {/* FIX #1: REMOVED STRAY CHARACTERS
              A stray comma (,) and closing curly brace (}) were here, causing a syntax error. 
              They have been deleted.
            */}

            {/* Teams Section with Loading States */}
            {authenticated && (
              <div className="teams-section" style={{ minHeight: '400px' }}>
                {teams.length > 0 ? (
                  // Teams data loaded - show actual content
                  teams.map(team => (
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
                  ))
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

                      <div className="skeleton-form" style={{ width: '100%', height: '40px', backgroundColor: '#e9ecef', borderRadius: '4px' }}></div>
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

                      <div className="skeleton-form" style={{ width: '100%', height: '40px', backgroundColor: '#e9ecef', borderRadius: '4px' }}></div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Matches Section with Loading States */}
            {authenticated && (
              <div className="team-matches mt-8 pt-8 border-top" style={{ minHeight: '300px' }}>
                {scheduleData.length > 0 ? (
                  <h2 className="text-3xl font-semibold mb-6 text-center">Team Matches Setup</h2>
                ) : (
                  <div className="matches-loading-skeleton">
                    <div className="skeleton-title" style={{ width: '300px', height: '48px', backgroundColor: '#e9ecef', borderRadius: '4px', margin: '0 auto 24px auto' }}></div>
                    <div className="skeleton-event" style={{ width: '100%', height: '200px', backgroundColor: '#e9ecef', borderRadius: '8px', marginBottom: '16px' }}></div>
                    <div className="skeleton-event" style={{ width: '100%', height: '200px', backgroundColor: '#e9ecef', borderRadius: '8px', marginBottom: '16px' }}></div>
                  </div>
                )}
                
                {scheduleData.map((event, eventIndex) => (
                  <div key={eventIndex} className="event-section mb-6">
                    <div className="event-header mb-4">
                      <h3 className="text-2xl text-success">{event.courseName}</h3>
                      <p className="text-muted">{formatDate(event.date)}</p>
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
                      {/* Championship Format Section */}
                      {event?.specialFormat?.type === 'Championship' ? (
                        <div className="championship-format-section mb-4 p-3 border rounded bg-light">
                          <h4 className="mb-3">Championship Format</h4>
                          {authenticated && (
                            <ChampionshipFormat 
                              event={event}
                              players={players}
                              onSave={async (formatData) => {
                                const db = getFirestore();
                                try {
                                  // Save championship format data
                                  await setDoc(doc(db, 'specialFormats', '2025-schedule'), {
                                    [event.date]: formatData
                                  }, { merge: true });

                                  // Create championship live match for results page
                                  const championshipMatch = {
                                    id: `${event.date}-championship`,
                                    courseName: event.courseName,
                                    date: event.date,
                                    matchType: 'championship',
                                    status: 'not_started',
                                    lastUpdate: new Date(),
                                    team1: {
                                      name: 'Putt Pirates',
                                      players: formatData.team1 || [],
                                      score: 0
                                    },
                                    team2: {
                                      name: 'Golden Boys',
                                      players: formatData.team2 || [],
                                      score: 0
                                    },
                                    holeAssignments: formatData.assignments || {},
                                    holeResults: {},
                                    currentScore: {
                                      team1Wins: 0,
                                      team2Wins: 0,
                                      holesPlayed: 0
                                    }
                                  };

                                  // Save to live matches collection
                                  await setDoc(doc(db, 'liveMatches', '2025'), {
                                    [`${event.date}-championship`]: championshipMatch
                                  }, { merge: true });

                                  alert('Championship format saved and live match created!');
                                } catch (error) {
                                  console.error('Error saving championship format:', error);
                                  alert('Error saving championship format. Please try again.');
                                }
                              }}
                            />
                          )}
                        </div>
                      ) : (
                        // Regular Team Match Format
                        event.teeTimes.map((time, timeIndex) => (
                          <div key={timeIndex} className="tee-time-slot mb-4 p-3 border rounded bg-light">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                              <h4 className="text-xl mb-0">{formatTeeTime(time)}</h4>
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
                              <h5 className="mb-3">Round Setup - {formatDate(event.date)}</h5>
                              
                              {/* Only show tee time selection if no 1v1 match is set for this round */}
                              <div className="mb-4">
                                <h6>Step 1: Select Tee Time for 1v1 Match</h6>
                                <div className="d-flex gap-3">
                                  {event.teeTimes.map((teeTime, idx) => {
                                    const roundKey = `${event.date}-${getRound(teeTime)}`;
                                    return (
                                      <Button
                                        key={idx}
                                        variant={selectedTeeTimes[roundKey] === idx ? 'success' : 'outline-success'}
                                        onClick={() => setSelectedTeeTimes(prev => ({ ...prev, [roundKey]: idx }))}
                                      >
                                        {formatTeeTime(teeTime)}
                                      </Button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Show match setup interface */}
                              {teamMatches[`${eventIndex}-${timeIndex}`]?.players?.length === 3 && (
                                <div className="match-setup mt-3">
                                  {/* 1v1 Match Setup - Available for all tee times */}
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
                                         matchSelections[`${eventIndex}-${timeIndex}`].players
                                       )}
                                      >
                                        Confirm 1v1 Match
                                      </Button>
                                    )}
                                  </div>

                                  {/* Alternating Match Setup - Available for all tee times */}
                                  <div className="mt-4">
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

                                    {/*
                                      FIX #2: COMPLETED TRUNCATED CODE
                                      Your code was cut off here. I've completed the block by closing
                                      all the open tags and parentheses.
                                    */}
                                    {matchSelections[`${eventIndex}-${timeIndex}`]?.soloPlayer && (
                                      <>
                                        <p className="text-muted small mt-4">2. Select which opponent starts on hole 1</p>
                                        <div className="d-flex gap-2 mt-2 mb-3">
                                          {matchSelections[`${eventIndex}-${timeIndex}`]?.team2Players?.map((player, idx) => (
                                            <Button key={idx} variant="outline-primary">
                                              {player}
                                            </Button>
                                          ))}
                                        </div>
                                        <Button
                                          variant="primary"
                                          size="sm"
                                          className="mt-2"
                                          onClick={() => {
                                            const players = [
                                              matchSelections[`${eventIndex}-${timeIndex}`].soloPlayer,
                                              ...matchSelections[`${eventIndex}-${timeIndex}`].team2Players
                                            ];
                                            handleAlternatingMatchSetup(event.date, timeIndex, players);
                                          }}
                                        >
                                          Confirm Alternating Match
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
export default Teams;