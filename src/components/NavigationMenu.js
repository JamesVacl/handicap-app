import { Navbar, Nav, Container } from 'react-bootstrap';
import { useRouter } from 'next/router';
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
        <Navbar.Brand bg="light" href="/">Guyscorp Golf</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link href="/" active={router.pathname === "/"}>Handicap Tracker</Nav.Link>
            <Nav.Link href="/schedule" active={router.pathname === "/schedule"}>Schedule</Nav.Link>
            <Nav.Link href="/teams" active={router.pathname === "/teams"}>Teams</Nav.Link>
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