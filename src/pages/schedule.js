import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/router';
import { Navbar, Nav, Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';  // Add this if not already in _app.js
import NavigationMenu from '../components/NavigationMenu';
import WeatherForecast from '../components/WeatherForecast';

const Schedule = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();

  const scheduleData = [
    {
      date: '2025-05-17',
      courseName: 'Cobble Beach Golf Links',
      city: 'London,CA',
      teeTimes: ['12:30', '12:40', '12:50']
    },
    {
      date: '2025-05-18',
      courseName: 'Lora Bay Golf Course',
      city: 'Guelph,CA',
      teeTimes: ['12:30', '12:40', '12:50']
    }
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
          
          <div className="schedule-layout">
            {/* Left side: Schedule */}
            <div className="schedule-content">
              {scheduleData.map((event, index) => (
                <div key={index} className="schedule-section">
                  <div className="schedule-info mb-3">
                    <h2 className="text-3xl font-bold mb-4">{formatDate(event.date)}</h2>
                    <h3 className="text-2xl text-success mb-4">{event.courseName}</h3>
                  </div>
                  
                  <div className="tee-times">
                    {event.teeTimes.map((time, timeIndex) => (
                      <div key={timeIndex} className="tee-time-slot mb-4">
                        <h4 className="text-xl font-semibold">{time} PM</h4>
                        <ul className="list-unstyled">
                          <li>Player 1: TBD</li>
                          <li>Player 2: TBD</li>
                          <li>Player 3: TBD</li>
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Right side: Weather */}
            <div className="weather-sidebar">
              <h2 className="text-2xl font-bold mb-4">Weather Forecast</h2>
              {scheduleData.map((event, index) => (
                <div key={index} className="mb-6">
                  <h3 className="text-xl text-success mb-2">{event.city.split(',')[0]}</h3>
                  <WeatherForecast city={event.city} />
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