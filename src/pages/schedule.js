import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs } from 'firebase/firestore'; // Add this import
import { useRouter } from 'next/router';
import { Navbar, Nav, Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';  // Add this if not already in _app.js
import NavigationMenu from '../components/NavigationMenu';
import WeatherForecast from '../components/WeatherForecast';

const Schedule = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();
  const [players, setPlayers] = useState([]); // Remove the hardcoded players array
  const [teeTimeAssignments, setTeeTimeAssignments] = useState({});

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
      notes: ''
    },
    {
      date: '2025-05-18',
      courseName: 'Batteaux Creek Golf Club',
      city: 'Nottawa,CA',
      teeTimes: ['9:00', '9:10', '9:20'],
      notes: ''
    },
    {
      date: '2025-08-08',
      courseName: 'Forest Dunes (The Loop)',
      city: 'Roscommon,US',
      teeTimes: ['14:00', '14:10', '14:20'],
      notes: 'Sneaky Friday round - 4 hour drive from London'
    },
    {
      date: '2025-08-09',
      courseName: 'Treetops (Smith Signature)',
      city: 'Gaylord,US',
      teeTimes: ['7:30', '7:40', '7:50'],
      notes: 'Blue tees - Modified strokeplay - 8 minutes from hotel'
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
      notes: 'Championship Matchplay - 45 minutes from Gaylord to Forest Dunes - 4 hour drive home to London'
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
                  {event.teeTimes.map((time, timeIndex) => (
                    <div key={timeIndex} className="tee-time-slot mb-4">
                      <h4 className="text-xl font-semibold">{formatTime(time)}</h4>
                      <div className="player-slots">
                        {[0, 1, 2].map((playerSlot) => (
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
                            {[0, 1, 2].map((playerSlot) => (
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
    </div>
  );
};

export default Schedule;