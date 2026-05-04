import { useState, useEffect, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, deleteField } from 'firebase/firestore'; // Add this import
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Navbar, Nav, Container, Dropdown } from 'react-bootstrap';


import NavigationMenu from '../components/NavigationMenu';
import FloatingNavigation from '../components/FloatingNavigation';
import MatchSetupModal from '../components/MatchSetupModal';
import TeamMatchSetupModal from '../components/TeamMatchSetupModal';
import { calculateLeaderboard } from '../firebase';


const Schedule = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();
  const [players, setPlayers] = useState([]); // Remove the hardcoded players array
  const [teeTimeAssignments, setTeeTimeAssignments] = useState({});
  const [matches, setMatches] = useState({});
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showTeamMatchModal, setShowTeamMatchModal] = useState(false);
  const [selectedEventIndex, setSelectedEventIndex] = useState(null);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(null);
  const [playerHandicaps, setPlayerHandicaps] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const standardHour = hour % 12 || 12;
    return `${standardHour}:${minutes} ${ampm}`;
  };

  const scheduleData = [
    {
      date: '2026-08-14',
      courseName: 'Legends on the Niagara - Ushers Creek',
      city: 'Niagara Falls, CA',
      teeTimes: ['12:30', '12:40','12:50'],
      notes: '2.5 hour drive from London - 20 minutes from Lucas - White Tees - Modified Strokeplay - $120'
    },
    {
      date: '2026-08-15',
      courseName: 'Thundering Waters',
      city: 'Niagara Falls, CA',
      teeTimes: ['8:10', '8:20', '8:30'],
      notes: 'TEAM DAY - Black Tees - 2V2 Scrambles- 5 minutes from hotel - $75',
      matches: [
        {
          teeTime: '7:30',
          format: 'Singles Match Play',
          stakes: '5-3-2',
          allowance: '100%'
        },
        {
          teeTime: '7:40',
          format: 'Singles Match Play',
          stakes: '5-3-2',
          allowance: '100%'
        },
        {
          teeTime: '7:50',
          format: 'Singles Match Play',
          stakes: '5-3-2',
          allowance: '100%'
        }
      ]
    },
    {
      courseName: 'Thundering Waters',
      city: 'Niagara Falls, CA',
      teeTimes: ['14:30', '14:40', '14:50'],
      notes: 'Black Tees - 2v2 Alt Shot - $75'
    },
    {
      date: '2026-08-16',
      courseName: 'Whirlpool',
      city: 'Niagara Falls, CA',
      teeTimes: ['10:10', '10:20', '10:30'],
      notes: 'White tees - Modified strokeplay - $110 - 5 minutes from hotel'
    },
    {
      courseName: 'Rainforest Cafe',
      city: 'Niagara Falls, CA',
      teeTimes: ['18:00', '18:10', '18:20'],
      notes: 'How many Mongoose Mai tais can we (dewy) drink???'
    },
    {
      date: '2026-08-17',
      courseName: 'Legends on the Niagara - Battlefield',
      city: 'Niagara Falls, CA',
      teeTimes: ['8:30', '8:40', '8:50'],
      notes: 'Championship day - Modified Strokeplay'
    }
  ];

  const groupedSchedule = useMemo(() => {
    const days = [];
    scheduleData.forEach((event, index) => {
      if (event.date) {
        days.push({
          date: event.date,
          rounds: [{ ...event, originalIndex: index }]
        });
      } else if (days.length > 0) {
        days[days.length - 1].rounds.push({ ...event, originalIndex: index });
      }
    });
    return days;
  }, []);

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
      const assignmentsRef = doc(db, 'teeTimeAssignments', '2025-schedule');
      
      const unsubscribe = onSnapshot(assignmentsRef, (doc) => {
        if (doc.exists()) {
          setTeeTimeAssignments(doc.data());
        }
      }, (error) => {
        console.error("Error fetching tee times:", error);
      });

      return () => unsubscribe();
    }
  }, [authenticated]);

  useEffect(() => {
    const fetchPlayers = async () => {
      if (authenticated) {
        const db = getFirestore();
        const playersSnapshot = await getDocs(collection(db, 'players'));
        const playersList = playersSnapshot.docs
          .map(doc => doc.data().name)
          .sort(); // Sort alphabetically
        setPlayers(playersList);
      }
    };

    fetchPlayers();
  }, [authenticated]);

  useEffect(() => {
    const fetchHandicaps = async () => {
      if (authenticated) {
        try {
          const db = getFirestore();
          const scoresRef = collection(db, 'scores');
          const scoresSnap = await getDocs(scoresRef);
          const scores = scoresSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Calculate handicaps using the imported calculation function
          const leaderboard = calculateLeaderboard(scores);
          const handicaps = {};
          leaderboard.forEach(entry => {
            handicaps[entry.name] = entry.handicap;
          });
          setPlayerHandicaps(handicaps);
        } catch (error) {
          console.error("Error fetching handicaps:", error);
        }
      }
    };

    fetchHandicaps();
  }, [authenticated]);

  // Add this useEffect to fetch matches
  useEffect(() => {
    if (authenticated) {
      const db = getFirestore();
      const matchesRef = doc(db, 'matches', '2025-schedule');
      
      const unsubscribe = onSnapshot(matchesRef, (doc) => {
        if (doc.exists()) {
          setMatches(doc.data());
        }
      }, (error) => {
        console.error("Error fetching matches:", error);
      });

      return () => unsubscribe();
    }
  }, [authenticated]);
  
  const handlePlayerAssignment = async (eventIndex, timeIndex, playerSlot, player) => {
    if (!authenticated) return;
    
    const db = getFirestore();
    const key = `${eventIndex}-${timeIndex}-${playerSlot}`;
    
    try {
      await setDoc(doc(db, 'teeTimeAssignments', '2025-schedule'), {
        ...teeTimeAssignments,
        [key]: player
      }, { merge: true });
    } catch (error) {
      console.error('Error saving assignment:', error);
    }
  };

  // Modify handleMatchSetup to save to Firebase
  const handleMatchSetup = async (eventIndex, timeIndex, matchData) => {
    if (!authenticated) return;
    
    const db = getFirestore();
    const baseKey = `${eventIndex}-${timeIndex}`;
    
    // Find the next available match number for this tee time
    const existingMatches = Object.keys(matches)
      .filter(key => key.startsWith(baseKey))
      .length;
    
    const key = `${baseKey}-match${existingMatches + 1}`;
    
    // Round handicaps for match play strokes
    const player1Handicap = Math.round(playerHandicaps[matchData.player1] || 0);
    const player2Handicap = Math.round(playerHandicaps[matchData.player2] || 0);
    const strokesGiven = Math.abs(player1Handicap - player2Handicap);

    try {
      await setDoc(doc(db, 'matches', '2025-schedule'), {
        ...matches,
        [key]: {
          player1: matchData.player1,
          player2: matchData.player2,
          format: 'Singles Match Play ',
          strokesGiven: strokesGiven,
          receivingStrokes: player1Handicap > player2Handicap ? matchData.player1 : matchData.player2,
          createdAt: new Date()
        }
      }, { merge: true });
    } catch (error) {
      console.error('Error saving match:', error);
    }
  };

  const handleTeamMatchSetup = async (eventIndex, timeIndex, matchData) => {
    if (!authenticated) return;
    
    const db = getFirestore();
    const baseKey = `${eventIndex}-${timeIndex}`;
    
    const existingMatches = Object.keys(matches)
      .filter(key => key.startsWith(baseKey))
      .length;
    
    const key = `${baseKey}-match${existingMatches + 1}`;
    
    const t1p1Hdcp = playerHandicaps[matchData.team1Player1] || 0;
    const t1p2Hdcp = playerHandicaps[matchData.team1Player2] || 0;
    const t2p1Hdcp = playerHandicaps[matchData.team2Player1] || 0;
    const t2p2Hdcp = playerHandicaps[matchData.team2Player2] || 0;

    const team1Hdcp = (t1p1Hdcp + t1p2Hdcp) / 2;
    const team2Hdcp = (t2p1Hdcp + t2p2Hdcp) / 2;
    const strokesGiven = Math.round(Math.abs(team1Hdcp - team2Hdcp));

    try {
      await setDoc(doc(db, 'matches', '2025-schedule'), {
        ...matches,
        [key]: {
          matchType: '2v2',
          format: matchData.format,
          team1: [matchData.team1Player1, matchData.team1Player2],
          team2: [matchData.team2Player1, matchData.team2Player2],
          strokesGiven: strokesGiven,
          receivingStrokes: team1Hdcp > team2Hdcp ? matchData.team1Player1 + ' & ' + matchData.team1Player2 : matchData.team2Player1 + ' & ' + matchData.team2Player2,
          createdAt: new Date()
        }
      }, { merge: true });
      
      // Save to Live Matches as well
      const liveMatchKey = `team-match-${Date.now()}`;
      await setDoc(doc(db, 'liveMatches', '2025'), {
        [liveMatchKey]: {
          matchType: '2v2',
          format: matchData.format,
          team1: [matchData.team1Player1, matchData.team1Player2],
          team2: [matchData.team2Player1, matchData.team2Player2],
          courseName: scheduleData[eventIndex].courseName,
          date: scheduleData[eventIndex].date,
          teeTime: scheduleData[eventIndex].teeTimes[timeIndex],
          status: 'not_started',
          createdAt: new Date(),
          currentScore: { player1Score: 0, player2Score: 0, holesPlayed: 0 }
        }
      }, { merge: true });
      
    } catch (error) {
      console.error('Error saving team match:', error);
    }
  };

  // Modify the handleDeleteMatch function
  const handleDeleteMatch = async (eventIndex, timeIndex, key) => {
    if (!authenticated) return;
    
    const db = getFirestore();
    
    try {
      // Create a new object without the deleted match
      const updatedMatches = { ...matches };
      delete updatedMatches[key];
      
      // Save the updated matches object
      await setDoc(doc(db, 'matches', '2025-schedule'), updatedMatches);

      // Delete the result if it exists
      await setDoc(doc(db, 'matchResults', '2025-results'), {
        [key]: deleteField()
      }, { merge: true });

    } catch (error) {
      console.error('Error deleting match:', error);
    }
  };

  const formatDate = (dateString) => {
    // Create date with explicit timezone handling
    const date = new Date(dateString + 'T12:00:00'); // Add noon time to avoid timezone issues
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      timeZone: 'America/Toronto' // Explicitly set timezone for Ontario
    });
  };

  const matchesByTeeTimeKey = useMemo(() => {
    const grouped = {};
    Object.entries(matches).forEach(([key, match]) => {
      const keyParts = key.split('-');
      const teeKey = keyParts.length >= 2 ? `${keyParts[0]}-${keyParts[1]}` : key;
      if (!grouped[teeKey]) grouped[teeKey] = [];
      grouped[teeKey].push([key, match]);
    });

    Object.keys(grouped).forEach((teeKey) => {
      grouped[teeKey].sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
    });

    return grouped;
  }, [matches]);

  const assignedPlayersByTeeTimeKey = useMemo(() => {
    const grouped = {};
    Object.entries(teeTimeAssignments).forEach(([key, value]) => {
      const parts = key.split('-');
      if (parts.length < 3 || !value) return;
      const teeKey = `${parts[0]}-${parts[1]}`;
      if (!grouped[teeKey]) grouped[teeKey] = new Set();
      grouped[teeKey].add(value);
    });
    return grouped;
  }, [teeTimeAssignments]);

  return (
    <>
      <Head>
        <title>Schedule - Guyscorp Golf</title>
        <meta name="description" content="Tournament schedule, tee times, and weather forecasts for Guyscorp golf events." />
      </Head>
      <div className="app-wrapper">
      {authenticated && <NavigationMenu />}
      <FloatingNavigation />
      <div className="home-container">
        <div className="overlay"></div>
        <div className="content glass-panel" style={{ maxWidth: '1400px' }}>
          <h1 className="text-5xl font-extrabold mb-2 text-center hero-title">Tournament Schedule</h1>
          <p className="text-center text-gray-600 mb-8 font-medium">Guyscorp Golf Weekend 2026</p>
          
          <div className="schedule-layout">
            {groupedSchedule.map((day, dayIndex) => (
              <div key={dayIndex} className="event-card glass-card d-flex flex-column h-100 p-4 p-md-5">
                <div className="schedule-info mb-4 text-center">
                  <h2 className="text-3xl font-bold mb-4">{formatDate(day.date)}</h2>
                </div>
                
                {day.rounds.map((round, roundIndex) => (
                  <div key={roundIndex} className={roundIndex > 0 ? "mt-5 pt-4 border-top" : ""}>
                    <div className="text-center mb-4">
                      <h3 className="text-2xl text-success mb-2">{round.courseName}</h3>
                      {round.notes && (
                        <p className="text-gray-600 italic mb-0">{round.notes}</p>
                      )}
                    </div>
                    
                    <div className="tee-times">
                      {round.teeTimes.map((time, timeIndex) => {
                        const originalIndex = round.originalIndex;
                        return (
                          <div key={timeIndex} className="tee-time-slot mb-4">
                            <div className="tee-time-header d-flex justify-content-between align-items-center mb-3">
                              <h4 className="text-xl font-semibold mb-0">{formatTime(time)}</h4>
                              <Dropdown align="end">
                                <Dropdown.Toggle variant="outline-success" size="sm" id={`dropdown-${originalIndex}-${timeIndex}`}>
                                  ➕ Add Match
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                  <Dropdown.Item onClick={() => {
                                    setSelectedEventIndex(originalIndex);
                                    setSelectedTimeIndex(timeIndex);
                                    setShowMatchModal(true);
                                  }}>
                                    1v1 Match
                                  </Dropdown.Item>
                                  <Dropdown.Item onClick={() => {
                                    setSelectedEventIndex(originalIndex);
                                    setSelectedTimeIndex(timeIndex);
                                    setShowTeamMatchModal(true);
                                  }}>
                                    2v2 Match
                                  </Dropdown.Item>
                                </Dropdown.Menu>
                              </Dropdown>
                            </div>
                            {(matchesByTeeTimeKey[`${originalIndex}-${timeIndex}`] || [])
                              .map(([key, match], matchIndex) => (
                                <div key={key} className="vs-matchup-card position-relative">
                                  <div className="vs-player-side">
                                    <span className="vs-player-name text-break">
                                      {match.matchType === '2v2' ? match.team1?.join(' & ') : match.player1}
                                    </span>
                                    <span className="vs-player-hdcp">
                                      {match.matchType === '2v2' ? 'Putt Pirates' : `HDCP: ${playerHandicaps[match.player1]?.toFixed(1) || 'N/A'}`}
                                    </span>
                                  </div>
                                  
                                  <div className="vs-badge-container">
                                    <div className="vs-badge">VS</div>
                                    {match.strokesGiven > 0 && (
                                      <div className="strokes-given-badge">
                                        {match.receivingStrokes} gets +{match.strokesGiven}
                                      </div>
                                    )}
                                    {match.matchType === '2v2' && (
                                      <span className="badge bg-success mt-1">{match.format}</span>
                                    )}
                                  </div>
                                  
                                  <div className="vs-player-side">
                                    <span className="vs-player-name text-break">
                                      {match.matchType === '2v2' ? match.team2?.join(' & ') : match.player2}
                                    </span>
                                    <span className="vs-player-hdcp">
                                      {match.matchType === '2v2' ? 'Golden Boys' : `HDCP: ${playerHandicaps[match.player2]?.toFixed(1) || 'N/A'}`}
                                    </span>
                                  </div>
                                  
                                  <button 
                                    className="btn btn-sm btn-outline-danger position-absolute"
                                    style={{ top: '8px', right: '8px', padding: '0px 6px' }}
                                    onClick={() => handleDeleteMatch(originalIndex, timeIndex, key)}
                                    title="Delete Match"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            
                            <div className="mt-3">
                              <button 
                                className="btn btn-outline-success btn-manage-group w-100 mb-2"
                                onClick={() => toggleGroup(`${originalIndex}-${timeIndex}`)}
                              >
                                {expandedGroups[`${originalIndex}-${timeIndex}`] ? 'Hide Group Management ▲' : 'Manage Tee Time Group ▼'}
                              </button>
                              
                              {expandedGroups[`${originalIndex}-${timeIndex}`] && (
                                <div className="player-slots p-3 bg-light rounded border w-100" style={{maxWidth: 'none'}}>
                                  <div className="row g-2">
                                    {[0, 1, 2, 3].map((playerSlot) => (
                                      <div className="col-12 col-md-6" key={playerSlot}>
                                        <select
                                          className="form-select shadow-sm"
                                          value={teeTimeAssignments[`${originalIndex}-${timeIndex}-${playerSlot}`] || ''}
                                          onChange={(e) => handlePlayerAssignment(originalIndex, timeIndex, playerSlot, e.target.value)}
                                        >
                                          <option value="">-- Select Player --</option>
                                          {players
                                            .filter(player => {
                                              const teeTimePlayers = assignedPlayersByTeeTimeKey[`${originalIndex}-${timeIndex}`] || new Set();
                                              return !teeTimePlayers.has(player) || 
                                                     teeTimeAssignments[`${originalIndex}-${timeIndex}-${playerSlot}`] === player;
                                            })
                                            .map((player) => (
                                              <option key={player} value={player}>
                                                {player}
                                              </option>
                                            ))}
                                        </select>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div> {/* End Schedule Layout Grid */}
        </div>
      </div>
      <MatchSetupModal 
        show={showMatchModal}
        onHide={() => setShowMatchModal(false)}
        players={players}
        onSave={(matchData) => handleMatchSetup(selectedEventIndex, selectedTimeIndex, matchData)}
      />
      <TeamMatchSetupModal 
        show={showTeamMatchModal}
        onHide={() => setShowTeamMatchModal(false)}
        players={players}
        onSave={(matchData) => handleTeamMatchSetup(selectedEventIndex, selectedTimeIndex, matchData)}
      />
    </div>
    </>
  );
};

export default Schedule;