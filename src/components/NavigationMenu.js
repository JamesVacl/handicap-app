import { Navbar, Nav, Container } from 'react-bootstrap';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { signOutUser } from 'src/firebase';

const NavigationMenu = () => {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOutUser();
    router.push('/');
  };

  return (
    <Navbar expand="lg" className="navbar-custom">
      <Container fluid>
        <Link href="/" passHref legacyBehavior>
          <Navbar.Brand>Guyscorp Golf</Navbar.Brand>
        </Link>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
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
          <Nav>
            <Nav.Link onClick={handleSignOut}>Sign Out</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default NavigationMenu;