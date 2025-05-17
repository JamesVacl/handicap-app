import { Modal, Button, Form } from 'react-bootstrap';

const MatchResultModal = ({ show, onHide, match, onSave }) => {
  const [result, setResult] = useState({
    winner: '',
    status: ''
  });

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Update Match Result</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Winner</Form.Label>
            <Form.Select 
              value={result.winner}
              onChange={(e) => setResult({...result, winner: e.target.value})}
            >
              <option value="">Select Winner</option>
              <option value={match.player1}>{match.player1}</option>
              <option value={match.player2}>{match.player2}</option>
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Result</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g., 4&3, 2UP"
              value={result.status}
              onChange={(e) => setResult({...result, status: e.target.value})}
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Close</Button>
        <Button variant="primary" onClick={() => onSave(result)}>Save Result</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default MatchResultModal;