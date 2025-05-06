import { Navbar, Nav, Container } from 'react-bootstrap';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { signOutUser } from 'src/firebase';
import CountdownTimer from './CountdownTimer';

const NavigationMenu = () => {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOutUser();
    router.push('/');
  };

  // Add handleTimerClick function
  const handleTimerClick = () => {
    router.push('/schedule');
  };

  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="navbar-custom">
      <Container fluid>
        <Link href="/" passHref legacyBehavior>
          <Navbar.Brand>Guyscorp Golf</Navbar.Brand>
        </Link>
        <Navbar.Toggle 
          aria-controls="basic-navbar-nav" 
          className="custom-toggler"
        />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Link href="/" passHref legacyBehavior>
              <Nav.Link active={router.pathname === "/"}>Handicap Tracker</Nav.Link>
            </Link>
            <Link href="/schedule" passHref legacyBehavior>
              <Nav.Link active={router.pathname === "/schedule"}>Schedule</Nav.Link>
            </Link>
            <Link href="/teams" passHref legacyBehavior>
              <Nav.Link active={router.pathname === "/teams"}>Teams</Nav.Link>
            </Link>
          </Nav>
          <Nav className="position-absolute start-50 translate-middle-x">
            <Nav.Link 
              className="text-white" 
              onClick={handleTimerClick}
              style={{ cursor: 'pointer' }}
            >
              <CountdownTimer />
            </Nav.Link>
          </Nav>
          <Nav>
            <Nav.Link onClick={handleSignOut}>Sign Out</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default NavigationMenu;