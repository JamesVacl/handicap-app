import { useState, useEffect, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, deleteField } from 'firebase/firestore'; // Add this import
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Navbar, Nav, Container } from 'react-bootstrap';


import NavigationMenu from '../components/NavigationMenu';
import FloatingNavigation from '../components/FloatingNavigation';
import WeatherForecast from '../components/WeatherForecast';
import MatchSetupModal from '../components/MatchSetupModal'; // Add this import
import { calculateLeaderboard } from '../firebase'; // Add this import at the top


const Schedule = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();
  const [players, setPlayers] = useState([]); // Remove the hardcoded players array
  const [teeTimeAssignments, setTeeTimeAssignments] = useState({});
  const [matches, setMatches] = useState({});
  const [showMatchModal, setShowMatchModal] = useState(false);
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

  const weatherCities = [
    'Niagara Falls, CA',
  ];

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
            {/* Left Column: Schedule Feed */}
            <div className="schedule-content">
              <div className="timeline-container">
                {scheduleData.map((event, index) => (
                  <div key={index} className="schedule-section glass-card mb-8 position-relative p-4 p-md-5">
                    <div className="timeline-node"></div>
                    <div className="schedule-info mb-4">
                  {event.date && (
                    <h2 className="text-3xl font-bold mb-4">{formatDate(event.date)}</h2>
                  )}
                  <h3 className="text-2xl text-success mb-4">{event.courseName}</h3>
                  {event.notes && (
                    <p className="text-gray-600 italic mb-4">{event.notes}</p>
                  )}
                </div>
                
                <div className="tee-times">
  <div>
    {event.teeTimes.map((time, timeIndex) => (
      <div key={timeIndex} className="tee-time-slot mb-4">
        <div className="tee-time-header d-flex justify-content-between align-items-center mb-3">
          <h4 className="text-xl font-semibold mb-0">{formatTime(time)}</h4>
          <button 
            className="btn btn-sm btn-outline-success"
            onClick={() => {
              setSelectedEventIndex(index);
              setSelectedTimeIndex(timeIndex);
              setShowMatchModal(true);
            }}
          >
            Set Match
          </button>
        </div>
        {(matchesByTeeTimeKey[`${index}-${timeIndex}`] || [])
          .map(([key, match], matchIndex) => (
            <div key={key} className="vs-matchup-card position-relative">
              <div className="vs-player-side">
                <span className="vs-player-name">{match.player1}</span>
                <span className="vs-player-hdcp">HDCP: {playerHandicaps[match.player1]?.toFixed(1) || 'N/A'}</span>
              </div>
              
              <div className="vs-badge-container">
                <div className="vs-badge">VS</div>
                {match.strokesGiven > 0 && (
                  <div className="strokes-given-badge">
                    {match.receivingStrokes} gets +{match.strokesGiven}
                  </div>
                )}
              </div>
              
              <div className="vs-player-side">
                <span className="vs-player-name">{match.player2}</span>
                <span className="vs-player-hdcp">HDCP: {playerHandicaps[match.player2]?.toFixed(1) || 'N/A'}</span>
              </div>
              
              <button 
                className="btn btn-sm btn-outline-danger position-absolute"
                style={{ top: '8px', right: '8px', padding: '0px 6px' }}
                onClick={() => handleDeleteMatch(index, timeIndex, key)}
                title="Delete Match"
              >
                ×
              </button>
            </div>
          ))}
        
        <div className="mt-3">
          <button 
            className="btn btn-outline-success btn-manage-group w-100 mb-2"
            onClick={() => toggleGroup(`${index}-${timeIndex}`)}
          >
            {expandedGroups[`${index}-${timeIndex}`] ? 'Hide Group Management ▲' : 'Manage Tee Time Group ▼'}
          </button>
          
          {expandedGroups[`${index}-${timeIndex}`] && (
            <div className="player-slots p-3 bg-light rounded border w-100" style={{maxWidth: 'none'}}>
              <div className="row g-2">
                {[0, 1, 2, 3].map((playerSlot) => (
                  <div className="col-12 col-md-6" key={playerSlot}>
                    <select
                      className="form-select shadow-sm"
                      value={teeTimeAssignments[`${index}-${timeIndex}-${playerSlot}`] || ''}
                      onChange={(e) => handlePlayerAssignment(index, timeIndex, playerSlot, e.target.value)}
                    >
                      <option value="">-- Select Player --</option>
                      {players
                        .filter(player => {
                          const teeTimePlayers = assignedPlayersByTeeTimeKey[`${index}-${timeIndex}`] || new Set();
                          return !teeTimePlayers.has(player) || 
                                 teeTimeAssignments[`${index}-${timeIndex}-${playerSlot}`] === player;
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
    ))}
  </div>

                </div>

                {/* Additional Round for Same Day */}
                {event.additionalRound && (
                  <div className="additional-round mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-2xl text-success mb-4">{event.additionalRound.courseName}</h3>
                    {event.additionalRound.notes && (
                      <p className="text-gray-600 italic mb-4">{event.additionalRound.notes}</p>
                    )}
                    <div className="tee-times">
                      {event.additionalRound.teeTimes.map((time, timeIndex) => (
                        <div key={timeIndex} className="tee-time-slot mb-4">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <h4 className="text-xl font-semibold mb-0">{formatTime(time)}</h4>
                            <button 
                              className="btn btn-outline-success btn-manage-group"
                              onClick={() => toggleGroup(`${index}-additional-${timeIndex}`)}
                            >
                              {expandedGroups[`${index}-additional-${timeIndex}`] ? 'Hide ▲' : 'Manage ▼'}
                            </button>
                          </div>
                          
                          {expandedGroups[`${index}-additional-${timeIndex}`] && (
                            <div className="player-slots p-3 bg-light rounded border w-100" style={{maxWidth: 'none'}}>
                              <div className="row g-2">
                                {[0, 1, 2, 3].map((playerSlot) => (
                                  <div className="col-12 col-md-6" key={playerSlot}>
                                    <select
                                      className="form-select shadow-sm"
                                      value={teeTimeAssignments[`${index}-additional-${timeIndex}-${playerSlot}`] || ''}
                                      onChange={(e) => handlePlayerAssignment(index, `additional-${timeIndex}`, playerSlot, e.target.value)}
                                    >
                                      <option value="">-- Select Player --</option>
                                      {players.map((player) => (
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
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            </div> {/* End Timeline container */}
          </div> {/* End Schedule Content Left Column */}

          {/* Right Sidebar - Weather */}
          <aside className="weather-sidebar glass-panel border-0" style={{ background: 'rgba(255, 255, 255, 0.95)' }}>
            <h3 className="text-2xl font-bold mb-4 text-dark text-center" style={{ borderBottom: '2px solid #50C878', paddingBottom: '0.5rem' }}>Course Conditions</h3>
            <div className="d-flex flex-column gap-4 mt-4">
              {weatherCities.map((city, index) => (
                <div key={index} className="weather-card bg-white shadow-sm rounded p-3 border border-light">
                  <h4 className="text-lg font-semibold mb-2 text-success" style={{ borderBottom: '1px solid #eee', paddingBottom: '0.25rem' }}>{city.split(',')[0]}</h4>
                  <WeatherForecast city={city} />
                </div>
              ))}
            </div>
          </aside>
          </div> {/* End Schedule Layout Grid */}
        </div>
      </div>
      <MatchSetupModal 
        show={showMatchModal}
        onHide={() => setShowMatchModal(false)}
        players={players}
        onSave={(matchData) => handleMatchSetup(selectedEventIndex, selectedTimeIndex, matchData)}
      />
    </div>
    </>
  );
};

export default Schedule;