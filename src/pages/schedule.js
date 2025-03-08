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
    <div>
      {authenticated && <NavigationMenu />}
      <div className="app-container">
        <div className="home-container">
          <div className="overlay"></div>
          <div className="content">
            <h1 className="text-4xl font-semibold mb-8 cursive-font text-center">Schedule</h1>
            {/* Add your schedule content here */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schedule;