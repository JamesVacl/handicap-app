import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/router';
import { Navbar, Nav, Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';  // Add this if not already in _app.js
import NavigationMenu from '../components/NavigationMenu';

const Schedule = () => {
  const [authenticated, setAuthenticated] = useState(false);
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

  return (
    <div className="app-wrapper">
      {authenticated && <NavigationMenu />}
      <div className="home-container">
        <div className="overlay"></div>
        <div className="content">
          <h1 className="text-4xl font-semibold mb-8 cursive-font text-center">Schedule</h1>
          
          <div className="schedule-section">
            <h2 className="text-3xl font-bold mb-4">May 17, 2025</h2>
            <h3 className="text-2xl text-success mb-4">Cobble Beach Golf Links</h3>
            
            <div className="tee-times">
              <div className="tee-time-slot mb-4">
                <h4 className="text-xl font-semibold">12:30 PM</h4>
                <ul className="list-unstyled">
                  <li>Player 1: TBD</li>
                  <li>Player 2: TBD</li>
                  <li>Player 3: TBD</li>
                </ul>
              </div>

              <div className="tee-time-slot mb-4">
                <h4 className="text-xl font-semibold">12:40 PM</h4>
                <ul className="list-unstyled">
                  <li>Player 1: TBD</li>
                  <li>Player 2: TBD</li>
                  <li>Player 3: TBD</li>
                </ul>
              </div>

              <div className="tee-time-slot mb-4">
                <h4 className="text-xl font-semibold">12:50 PM</h4>
                <ul className="list-unstyled">
                  <li>Player 1: TBD</li>
                  <li>Player 2: TBD</li>
                  <li>Player 3: TBD</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="schedule-section">
            <h2 className="text-3xl font-bold mb-4">May 18, 2025</h2>
            <h3 className="text-2xl text-success mb-4">Lora Bay Golf Course</h3>
            
            <div className="tee-times">
              <div className="tee-time-slot mb-4">
                <h4 className="text-xl font-semibold">12:30 PM</h4>
                <ul className="list-unstyled">
                  <li>Player 1: TBD</li>
                  <li>Player 2: TBD</li>
                  <li>Player 3: TBD</li>
                </ul>
              </div>

              <div className="tee-time-slot mb-4">
                <h4 className="text-xl font-semibold">12:40 PM</h4>
                <ul className="list-unstyled">
                  <li>Player 1: TBD</li>
                  <li>Player 2: TBD</li>
                  <li>Player 3: TBD</li>
                </ul>
              </div>

              <div className="tee-time-slot mb-4">
                <h4 className="text-xl font-semibold">12:50 PM</h4>
                <ul className="list-unstyled">
                  <li>Player 1: TBD</li>
                  <li>Player 2: TBD</li>
                  <li>Player 3: TBD</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schedule;