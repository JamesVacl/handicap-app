import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/router';
import { Navbar, Nav, Container } from 'react-bootstrap';
import NavigationMenu from '../components/NavigationMenu'; // Add this import

const Teams = () => {
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
  }, [router]); // Add router to the dependency array

  return (
    <div>
      <NavigationMenu />
      <Container>
        <h1>Teams</h1>
        {/* Add your teams content here */}
      </Container>
    </div>
  );
};

export default Teams;