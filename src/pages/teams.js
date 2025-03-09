import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/router';
import { Navbar, Nav, Container, Button, Form } from 'react-bootstrap';
import { getTeams, getScores, addTeam, updateTeam, getPlayerHandicaps } from '../firebase';
import NavigationMenu from '../components/NavigationMenu';
import Image from 'next/image'; // Import the Image component from Next.js

const Teams = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState('');
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

  useEffect(() => {
    const fetchData = async () => {
      if (authenticated) {
        const teamsData = await getTeams();
        setTeams(teamsData);
        
        const playerHandicaps = await getPlayerHandicaps();
        setPlayers(playerHandicaps);
      }
    };
    fetchData();
  }, [authenticated]);

  const calculateTeamAverage = (teamPlayers) => {
    if (!teamPlayers.length) return 0;
    const sum = teamPlayers.reduce((acc, player) => acc + player.handicap, 0);
    return (sum / teamPlayers.length).toFixed(1);
  };

  const handleAddPlayer = async (teamId, playerName) => {
    const player = players.find(p => p.name === playerName);
    if (!player) return;

    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const updatedPlayers = [...team.players, player];
    const averageHandicap = calculateTeamAverage(updatedPlayers);

    await updateTeam(teamId, {
      players: updatedPlayers,
      averageHandicap
    });

    // Refresh teams data
    const teamsData = await getTeams();
    setTeams(teamsData);
  };

  return (
    <div className="app-wrapper">
      {authenticated && <NavigationMenu />}
      <div className="home-container">
        <div className="overlay"></div>
        <div className="content">
          <h1 className="text-4xl font-semibold mb-8 cursive-font text-center">Teams</h1>
          
          {teams.map(team => (
            <div key={team.id} className="team-section mb-4">
              <div className="team-header">
                <div className="team-logo-container">
                  <Image 
                    src={team.name === "Putt Pirates" ? "/putt-pirate-logo.png" : "/golden-boys-logo.jpeg"}
                    alt={`${team.name} Logo`}
                    width={100} 
                    height={100} 
                    className="team-logo" 
                  />
                </div>
                <div className="team-info">
                  <h2 className="text-2xl font-bold">{team.name}</h2>
                  <p className="text-xl text-success">
                    Team Average: {team.averageHandicap || 0}
                  </p>
                </div>
              </div>
              
              <div className="players-list my-3">
                {team.players?.map(player => (
                  <div key={player.name} className="player-item">
                    {player.name} - Handicap: {player.handicap}
                  </div>
                ))}
              </div>

              <Form className="mt-3">
                <Form.Group className="d-flex gap-2">
                  <Form.Select 
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    className="w-75"
                  >
                    <option value="">Select Player</option>
                    {players.map(player => (
                      <option key={player.name} value={player.name}>
                        {player.name} ({player.handicap})
                      </option>
                    ))}
                  </Form.Select>
                  <Button 
                    variant="success"
                    onClick={() => handleAddPlayer(team.id, selectedPlayer)}
                  >
                    Add Player
                  </Button>
                </Form.Group>
              </Form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Teams;