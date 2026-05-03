import { Modal, Button } from 'react-bootstrap';
import { useState } from 'react';

const TeamMatchSetupModal = ({ show, onHide, players, onSave }) => {
  const [team1Player1, setTeam1Player1] = useState('');
  const [team1Player2, setTeam1Player2] = useState('');
  const [team2Player1, setTeam2Player1] = useState('');
  const [team2Player2, setTeam2Player2] = useState('');
  const [format, setFormat] = useState('2v2 Scramble');

  const handleSave = () => {
    onSave({
      team1Player1,
      team1Player2,
      team2Player1,
      team2Player2,
      format,
      matchType: '2v2',
      allowance: '100%'
    });
    onHide();
  };

  const availablePlayers = players || [];
  const getFilteredPlayers = (currentPlayer) => {
    const selected = [team1Player1, team1Player2, team2Player1, team2Player2].filter(p => p && p !== currentPlayer);
    return availablePlayers.filter(p => !selected.includes(p));
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Set Up Team Match (2v2)</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3">
          <label className="form-label">Match Format</label>
          <select 
            className="form-select" 
            value={format} 
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="2v2 Scramble">2v2 Scramble</option>
            <option value="2v2 Alt Shot">2v2 Alt Shot</option>
            <option value="Fourball (Best Ball)">Fourball (Best Ball)</option>
          </select>
        </div>
        
        <h5 className="mt-4 border-bottom pb-2 text-success">Putt Pirates</h5>
        <div className="mb-3">
          <label className="form-label">Player 1</label>
          <select className="form-select" value={team1Player1} onChange={(e) => setTeam1Player1(e.target.value)}>
            <option value="">Select Player</option>
            {getFilteredPlayers(team1Player1).map(player => <option key={player} value={player}>{player}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Player 2</label>
          <select className="form-select" value={team1Player2} onChange={(e) => setTeam1Player2(e.target.value)}>
            <option value="">Select Player</option>
            {getFilteredPlayers(team1Player2).map(player => <option key={player} value={player}>{player}</option>)}
          </select>
        </div>

        <h5 className="mt-4 border-bottom pb-2 text-success">Golden Boys</h5>
        <div className="mb-3">
          <label className="form-label">Player 1</label>
          <select className="form-select" value={team2Player1} onChange={(e) => setTeam2Player1(e.target.value)}>
            <option value="">Select Player</option>
            {getFilteredPlayers(team2Player1).map(player => <option key={player} value={player}>{player}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Player 2</label>
          <select className="form-select" value={team2Player2} onChange={(e) => setTeam2Player2(e.target.value)}>
            <option value="">Select Player</option>
            {getFilteredPlayers(team2Player2).map(player => <option key={player} value={player}>{player}</option>)}
          </select>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cancel</Button>
        <Button 
          variant="success" 
          onClick={handleSave}
          disabled={!team1Player1 || !team1Player2 || !team2Player1 || !team2Player2}
        >
          Save Match
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TeamMatchSetupModal;
