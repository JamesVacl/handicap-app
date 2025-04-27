import { Modal, Button } from 'react-bootstrap';
import { useState } from 'react';

const MatchSetupModal = ({ show, onHide, players, onSave }) => {
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');

  const handleSave = () => {
    onSave({
      player1,
      player2,
      format: 'Singles Match Play',
      stakes: '5-3-2',
      allowance: '100%'
    });
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Set Up Match</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3">
          <label className="form-label">Player 1</label>
          <select 
            className="form-select" 
            value={player1} 
            onChange={(e) => setPlayer1(e.target.value)}
          >
            <option value="">Select Player</option>
            {players.map(player => (
              <option key={player} value={player}>
                {player}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Player 2</label>
          <select 
            className="form-select" 
            value={player2} 
            onChange={(e) => setPlayer2(e.target.value)}
          >
            <option value="">Select Player</option>
            {players
              .filter(p => p !== player1)
              .map(player => (
                <option key={player} value={player}>
                  {player}
                </option>
              ))}
          </select>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button 
          variant="success" 
          onClick={handleSave}
          disabled={!player1 || !player2}
        >
          Save Match
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default MatchSetupModal;