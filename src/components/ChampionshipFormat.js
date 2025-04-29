import { useState, useEffect } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { getFirestore, doc, onSnapshot, getDoc } from 'firebase/firestore';

const ChampionshipFormat = ({ event, players, onSave }) => {
  const [showModal, setShowModal] = useState(false);
  const [team1Players, setTeam1Players] = useState([]);
  const [team2Players, setTeam2Players] = useState([]);
  const [assignments, setAssignments] = useState({});
  const holes = Array.from({ length: 18 }, (_, i) => i + 1);

  // Add real-time listener for teams
  useEffect(() => {
    const db = getFirestore();
    const teamsRef = doc(db, 'teams', '2025-teams');
    
    const unsubscribe = onSnapshot(teamsRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        console.log('Teams data:', data); // Debug log
        setTeam1Players(data.puttPirates || []);
        setTeam2Players(data.goldenBoys || []);
      }
    }, (error) => {
      console.error("Error fetching teams:", error);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  // Add real-time listener for assignments
  useEffect(() => {
    const db = getFirestore();
    const formatRef = doc(db, 'specialFormats', '2025-schedule');
    
    const unsubscribe = onSnapshot(formatRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data[event.date]) {  // Use event.date instead of index
          setAssignments(data[event.date].assignments || {});
          // Also get the saved teams
          setTeam1Players(data[event.date].team1 || []);
          setTeam2Players(data[event.date].team2 || []);
        }
      }
    }, (error) => {
      console.error("Error fetching data:", error);
    });

    return () => unsubscribe();
  }, [event.date]);

  // Debug log when teams change
  useEffect(() => {
    console.log('Team1Players:', team1Players);
    console.log('Team2Players:', team2Players);
  }, [team1Players, team2Players]);

  // Add a team selection modal
  const [showTeamModal, setShowTeamModal] = useState(false);

  const handleSaveTeams = async () => {
    try {
      await onSave({
        team1: team1Players,
        team2: team2Players,
        assignments
      });
      setShowTeamModal(false);
    } catch (error) {
      console.error("Error saving teams:", error);
    }
  };

  const handleSaveAssignments = async () => {
    try {
      await onSave({
        team1: team1Players,
        team2: team2Players,
        assignments
      });
      setShowModal(false);
    } catch (error) {
      console.error("Error saving assignments:", error);
    }
  };

  // Modify the Modal to only show hole assignments
  return (
    <div className="championship-format mt-4 p-3 border border-success rounded">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Championship Format</h4>
        <div>
          <Button 
            variant="outline-primary" 
            size="sm"
            className="me-2"
            onClick={() => setShowTeamModal(true)}
          >
            Set Teams
          </Button>
          <Button 
            variant="outline-success" 
            size="sm"
            onClick={() => setShowModal(true)}
            disabled={!team1Players.length || !team2Players.length}
          >
            Set Hole Assignments
          </Button>
        </div>
      </div>

      {/* Display teams */}
      <div className="teams-display">
        <div className="row">
          <div className="col-md-6">
            <h5>Putt Pirates</h5>
            <ul className="list-unstyled">
              {team1Players.map(player => (
                <li key={player}>{player}</li>
              ))}
            </ul>
          </div>
          <div className="col-md-6">
            <h5>Golden Boys</h5>
            <ul className="list-unstyled">
              {team2Players.map(player => (
                <li key={player}>{player}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Rest of the existing display code */}
        <div className="hole-assignments mt-3">
          <h5>Hole Assignments</h5>
          <div className="row">
            {holes.map(hole => (
              <div key={hole} className="col-md-4 mb-2">
                <small>
                  Hole {hole}: {assignments[hole]?.team1 || '?'} vs {assignments[hole]?.team2 || '?'}
                </small>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team Selection Modal */}
      <Modal show={showTeamModal} onHide={() => setShowTeamModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Set Teams</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row">
            <div className="col-md-6">
              <h5>Putt Pirates</h5>
              {players.map(player => (
                <div key={player} className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={`team1-${player}`}
                    checked={team1Players.includes(player)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTeam1Players([...team1Players, player]);
                      } else {
                        setTeam1Players(team1Players.filter(p => p !== player));
                      }
                    }}
                  />
                  <label className="form-check-label" htmlFor={`team1-${player}`}>
                    {player}
                  </label>
                </div>
              ))}
            </div>
            <div className="col-md-6">
              <h5>Golden Boys</h5>
              {players.map(player => (
                <div key={player} className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={`team2-${player}`}
                    checked={team2Players.includes(player)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTeam2Players([...team2Players, player]);
                      } else {
                        setTeam2Players(team2Players.filter(p => p !== player));
                      }
                    }}
                  />
                  <label className="form-check-label" htmlFor={`team2-${player}`}>
                    {player}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowTeamModal(false)}>
            Close
          </Button>
          <Button 
            variant="success" 
            onClick={handleSaveTeams}
          >
            Save Teams
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modify Modal to only show hole assignments */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Set Hole Assignments</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="hole-assignments">
            <h5>Hole Assignments</h5>
            {holes.map(hole => (
              <div key={hole} className="row mb-2">
                <div className="col-12">
                  <strong>Hole {hole}</strong>
                </div>
                <div className="col-md-6">
                  <select
                    className="form-select"
                    value={assignments[hole]?.team1 || ''}
                    onChange={(e) => setAssignments({
                      ...assignments,
                      [hole]: { ...assignments[hole], team1: e.target.value }
                    })}
                  >
                    <option value="">Select Putt Pirates Player</option>
                    {team1Players.map(player => (
                      <option key={player} value={player}>{player}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <select
                    className="form-select"
                    value={assignments[hole]?.team2 || ''}
                    onChange={(e) => setAssignments({
                      ...assignments,
                      [hole]: { ...assignments[hole], team2: e.target.value }
                    })}
                  >
                    <option value="">Select Golden Boys Player</option>
                    {team2Players.map(player => (
                      <option key={player} value={player}>{player}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
          <Button 
            variant="success" 
            onClick={handleSaveAssignments}
          >
            Save Assignments
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ChampionshipFormat;