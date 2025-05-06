import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, deleteField } from 'firebase/firestore'; // Add this import
import { useRouter } from 'next/router';
import { Navbar, Nav, Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';  // Add this if not already in _app.js
import NavigationMenu from '../components/NavigationMenu';
import WeatherForecast from '../components/WeatherForecast';
import MatchSetupModal from '../components/MatchSetupModal'; // Add this import
import { calculateLeaderboard } from '../firebase'; // Add this import at the top
import ChampionshipFormat from '../components/ChampionshipFormat';

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

  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const standardHour = hour % 12 || 12;
    return `${standardHour}:${minutes} ${ampm}`;
  };

  const scheduleData = [
    {
      date: '2025-05-17',
      courseName: 'Cobble Beach Golf Links',
      city: 'Owen Sound,CA',
      teeTimes: ['12:30', '12:40', '12:50'],
      notes: 'Skins rules: lowest net score on a hole wins a "skin". If the hole is tied, the skin is carried over to the next hole and the next hole is now worth 2 skins.'
    },
    {
      date: '2025-05-18',
      courseName: 'Lora Bay Golf Course',
      city: 'Thorbury,CA',
      teeTimes: ['10:20', '10:30', '10:40'],
      notes: 'the 3 winners from each group will pair up for the winner of the Dolcetto Invitational.'
    },
    {
      date: '2025-08-08',
      courseName: 'Forest Dunes (The Loop)',
      city: 'Roscommon,US',
      teeTimes: ['13:33', '13:44',],
      notes: 'Sneaky Friday round - 4 hour drive from London'
    },
    {
      date: '2025-08-09',
      courseName: 'Treetops (Smith Signature)',
      city: 'Gaylord,US',
      teeTimes: ['7:30', '7:40', '7:50'],
      notes: 'Blue tees - Modified strokeplay - 8 minutes from hotel',
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
      courseName: 'Treetops (Jones Masterpiece)',
      city: 'Gaylord,US',
      teeTimes: ['14:53', '15:04', '15:15'],
      notes: 'Blue tees - Modified strokeplay - 8 minutes from Smith Signature'
    },
    {
      date: '2025-08-10',
      courseName: 'Belvedere Golf Club',
      city: 'Charlevoix,US',
      teeTimes: ['10:10', '10:20', '10:30'],
      notes: 'White tees - Modified strokeplay - $150 - 55 minutes from hotel'
    },
    {
      courseName: 'Threetops',
      city: 'Gaylord,US',
      teeTimes: ['18:40', '18:50', '19:00'],
      notes: '$5 per hole skins game - 55 minutes back to Treetops'
    },
    {
      date: '2025-08-11',
      courseName: 'Forest Dunes',
      city: 'Roscommon,US',
      teeTimes: ['9:20', '9:31', '9:42'],
      notes: 'Championship Matchplay - 45 minutes from Gaylord to Forest Dunes - 4 hour drive home to London',
      specialFormat: {
        type: 'Championship',
        teams: {
          team1: {
            name: 'Team 1',
            players: [],
            holeAssignments: {}
          },
          team2: {
            name: 'Team 2',
            players: [],
            holeAssignments: {}
          }
        }
      }
    }
  ];

  const weatherCities = [
    'London,CA',
    'Guelph,CA',
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
    const key = `${eventIndex}-${timeIndex}`;
    
    // Calculate strokes given
    const player1Handicap = playerHandicaps[matchData.player1] || 0;
    const player2Handicap = playerHandicaps[matchData.player2] || 0;
    const strokesGiven = Math.abs(player1Handicap - player2Handicap);
    
    try {
      await setDoc(doc(db, 'matches', '2025-schedule'), {
        ...matches,
        [key]: {
          player1: matchData.player1,
          player2: matchData.player2,
          format: 'Singles Match Play',
          strokesGiven: Math.round(strokesGiven), // Round to nearest whole number
          receivingStrokes: player1Handicap > player2Handicap ? matchData.player1 : matchData.player2,
          createdAt: new Date()
        }
      }, { merge: true });
    } catch (error) {
      console.error('Error saving match:', error);
    }
  };

// Add this new function after handleMatchSetup
const handleDeleteMatch = async (eventIndex, timeIndex) => {
  if (!authenticated) return;
  
  const db = getFirestore();
  const key = `${eventIndex}-${timeIndex}`;
  
  try {
    await setDoc(doc(db, 'matches', '2025-schedule'), {
      ...matches,
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

  return (
    <div className="app-wrapper">
      {authenticated && <NavigationMenu />}
      <div className="home-container">
        <div className="overlay"></div>
        <div className="content">
          <h1 className="text-4xl font-semibold mb-8 cursive-font text-center">Schedule</h1>
          
          {/* Schedule Content */}
          <div className="schedule-content mb-8">
            {scheduleData.map((event, index) => (
              <div key={index} className="schedule-section mb-6">
                <div className="schedule-info mb-3">
                  {event.date && (
                    <h2 className="text-3xl font-bold mb-4">{formatDate(event.date)}</h2>
                  )}
                  <h3 className="text-2xl text-success mb-4">{event.courseName}</h3>
                  {event.notes && (
                    <p className="text-gray-600 italic mb-4">{event.notes}</p>
                  )}
                </div>
                
                <div className="tee-times">
                  {event.specialFormat?.type === 'Championship' ? (
  <>
    {/* Championship format above tee times */}
    <div className="mb-4 pb-4 border-bottom">
      <ChampionshipFormat 
        event={event}
        players={players}
        index={index}
        date={event.date}
        onSave={async (formatData) => {
          const db = getFirestore();
          try {
            await setDoc(doc(db, 'specialFormats', '2025-schedule'), {
              [`${event.date}`]: formatData  // Changed from index to event.date
            }, { merge: true });
          } catch (error) {
            console.error('Error saving format:', error);
          }
        }}
      />
    </div>

    {/* Regular tee time slots below */}
    <div className="tee-times">
      <h4 className="mb-3">Tee Times</h4>
      {event.teeTimes.map((time, timeIndex) => (
        <div key={timeIndex} className="tee-time-slot mb-4">
          <div className="tee-time-header d-flex justify-content-between align-items-center mb-3">
            <h4 className="text-xl font-semibold mb-0">{formatTime(time)}</h4>
          </div>
          <div className="player-slots">
            {[0, 1, 2, 3].map((playerSlot) => (
              <select
                key={playerSlot}
                className="form-select mb-2"
                value={teeTimeAssignments[`${index}-${timeIndex}-${playerSlot}`] || ''}
                onChange={(e) => handlePlayerAssignment(index, timeIndex, playerSlot, e.target.value)}
              >
                <option value="">-- Select Player --</option>
                {players.map((player) => (
                  <option key={player} value={player}>
                    {player}
                  </option>
                ))}
              </select>
            ))}
          </div>
        </div>
      ))}
    </div>
  </>
) : (
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
        {matches[`${index}-${timeIndex}`] && (
<div className="match-info mb-3 p-2 bg-success bg-opacity-10 rounded">
  <div className="d-flex justify-content-between align-items-center">
    <div className="text-center">
      <span className="d-block">{matches[`${index}-${timeIndex}`].player1}</span>
      <small className="text-muted">
        ({playerHandicaps[matches[`${index}-${timeIndex}`].player1]?.toFixed(1) || 'N/A'})
      </small>
    </div>
    <small className="text-success mx-2">vs</small>
    <div className="text-center">
      <span className="d-block">{matches[`${index}-${timeIndex}`].player2}</span>
      <small className="text-muted">
        ({playerHandicaps[matches[`${index}-${timeIndex}`].player2]?.toFixed(1) || 'N/A'})
      </small>
    </div>
    <button 
      className="btn btn-sm btn-outline-danger ms-3"
      onClick={() => handleDeleteMatch(index, timeIndex)}
      title="Delete Match"
    >
      ×
    </button>
  </div>
  <small className="d-block text-muted mt-1">
    Format: {matches[`${index}-${timeIndex}`].format} | 
    {matches[`${index}-${timeIndex}`].strokesGiven > 0 ? (
      `${matches[`${index}-${timeIndex}`].receivingStrokes} receives ${matches[`${index}-${timeIndex}`].strokesGiven}`
    ) : (
      'Even Match'
    )}
  </small>
</div>
)}
        <div className="player-slots">
          {[0, 1, 2, 3].map((playerSlot) => (
            <select
              key={playerSlot}
              className="form-select mb-2"
              value={teeTimeAssignments[`${index}-${timeIndex}-${playerSlot}`] || ''}
              onChange={(e) => handlePlayerAssignment(index, timeIndex, playerSlot, e.target.value)}
            >
              <option value="">-- Select Player --</option>
              {players
                .filter(player => {
                  const teeTimePlayers = Object.entries(teeTimeAssignments)
                    .filter(([key]) => key.startsWith(`${index}-${timeIndex}`))
                    .map(([_, value]) => value);
                  return !teeTimePlayers.includes(player) || 
                         teeTimeAssignments[`${index}-${timeIndex}-${playerSlot}`] === player;
                })
                .map((player) => (
                  <option key={player} value={player}>
                    {player}
                  </option>
                ))}
            </select>
          ))}
        </div>
      </div>
    ))}
  </div>
)}

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
                          <h4 className="text-xl font-semibold">{formatTime(time)}</h4>
                          <div className="player-slots">
                            {[0, 1, 2, 3].map((playerSlot) => (    // Changed from [0, 1, 2]
                              <select
                                key={playerSlot}
                                className="form-select mb-2"
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
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Weather Section at bottom */}
          <div className="weather-section mt-12 pt-8 border-t border-gray-200">
            <h2 className="text-3xl font-bold mb-6 text-center">Weather Forecast</h2>
            <div className="weather-grid">
              {weatherCities.map((city, index) => (
                <div key={index} className="weather-card">
                  <h3 className="text-xl font-semibold mb-3">{city.split(',')[0]}</h3>
                  <WeatherForecast city={city} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <MatchSetupModal 
        show={showMatchModal}
        onHide={() => setShowMatchModal(false)}
        players={players}
        onSave={(matchData) => handleMatchSetup(selectedEventIndex, selectedTimeIndex, matchData)}
      />
    </div>
  );
};

export default Schedule;