import { useState, useEffect } from 'react';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/router';
import { Modal, Button, Form } from 'react-bootstrap';
import NavigationMenu from '../components/NavigationMenu';
import HeadToHeadStats from '../components/HeadToHeadStats';

const Results = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [matches, setMatches] = useState({});
  const [matchResults, setMatchResults] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [result, setResult] = useState({ winner: '', status: '' });
  const [showH2H, setShowH2H] = useState(false);
  const [matchHistory, setMatchHistory] = useState({});
  const [activeMatches, setActiveMatches] = useState({});
  const [dateFilter, setDateFilter] = useState('all');
  const router = useRouter();

  // Authentication check
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

  // Fetch matches and results
  useEffect(() => {
    if (authenticated) {
      const db = getFirestore();
      const matchHistoryRef = doc(db, 'matchHistory', '2025-matches');
      const activeMatchesRef = doc(db, 'matches', '2025-schedule');
      const matchResultsRef = doc(db, 'matchResults', '2025-results');
      
      // Fetch matches and results
      const unsubscribeHistory = onSnapshot(matchHistoryRef, (doc) => {
        if (doc.exists()) {
          setMatchHistory(doc.data());
        }
      });

      const unsubscribeActive = onSnapshot(activeMatchesRef, (doc) => {
        if (doc.exists()) {
          setActiveMatches(doc.data());
        }
      });

      const unsubscribeResults = onSnapshot(matchResultsRef, (doc) => {
        if (doc.exists()) {
          setMatchResults(doc.data());
        }
      });

      return () => {
        unsubscribeHistory();
        unsubscribeActive();
        unsubscribeResults();
      };
    }
  }, [authenticated]);

  // Update the getAllMatches function
  const getAllMatches = () => {
    if (!matches || !activeMatches) return [];
    
    const allMatches = [
      ...Object.entries(matches).map(([key, match]) => ({
        ...match,
        id: key
      })),
      ...Object.entries(activeMatches).map(([key, match]) => ({
        ...match,
        id: key
      }))
    ];

    console.log('All matches:', allMatches);
    return allMatches;
  };

  const handleUpdateResult = (matchKey) => {
    const selectedMatch = getAllMatches().find(match => match.id === matchKey);
    
    if (selectedMatch) {
      setSelectedMatch(matchKey);
      setResult({
        winner: matchResults[matchKey]?.winner || '',
        status: matchResults[matchKey]?.status || ''
      });
      setShowModal(true);
    }
  };

  const handleSaveResult = async () => {
    if (!selectedMatch) return;

    try {
      const db = getFirestore();
      const resultData = result.winner && result.status ? {
        winner: result.winner,
        status: result.status,
        timestamp: new Date()
      } : null;

      await setDoc(doc(db, 'matchResults', '2025-results'), {
        [selectedMatch]: resultData
      }, { merge: true });

      // Update local state
      setMatchResults(prev => ({
        ...prev,
        [selectedMatch]: resultData
      }));
      
      setShowModal(false);
    } catch (error) {
      console.error('Error saving result:', error);
    }
  };

  return (
    <div className="app-wrapper">
      {authenticated && <NavigationMenu />}
      <div className="home-container">
        <div className="overlay"></div>
        <div className="content">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h1 className="text-4xl font-semibold cursive-font">Match Results</h1>
            <Button 
              variant="outline-success"
              onClick={() => setShowH2H(!showH2H)}
            >
              {showH2H ? 'Hide H2H Stats' : 'Show H2H Stats'}
            </Button>
          </div>

          {showH2H && (
            <HeadToHeadStats 
              matches={getAllMatches()}
              matchResults={matchResults} 
            />
          )}

          <div className="results-content">
            <Form.Select 
              className="mb-4"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="all">All Matches</option>
              <option value="active">Active Matches</option>
              <option value="2025">2025 Season</option>
              {/* Add more seasons as needed */}
            </Form.Select>

            {getAllMatches()
              .filter(match => {
                if (dateFilter === 'active') return match.isActive;
                if (dateFilter === 'all') return true;
                return match.date?.startsWith(dateFilter);
              })
              .map(match => (
                <div key={match.id} className="match-result-card mb-4 p-4 border rounded">
                  <div className="d-flex flex-column">
                    <small className="text-muted mb-2">
                      {match.date} - {match.courseName}
                    </small>
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="me-4">
                        <h4 className="mb-2">
                          <span className={matchResults[match.id]?.winner === match.player1 ? 'fw-bold text-success' : ''}>
                            {match.player1}
                          </span>
                          {' vs '}
                          <span className={matchResults[match.id]?.winner === match.player2 ? 'fw-bold text-success' : ''}>
                            {match.player2}
                          </span>
                        </h4>
                        <small className="text-muted d-block">
                          {matchResults[match.id] ? (
                            <>
                              <span className="text-success fw-bold">{matchResults[match.id].winner}</span>
                              {' won '}
                              <span className="fw-bold">{matchResults[match.id].status}</span>
                            </>
                          ) : (
                            'Result Pending'
                          )}
                        </small>
                      </div>
                      <button
                        className="btn btn-outline-primary btn-sm align-self-center"
                        onClick={() => handleUpdateResult(match.id)}
                      >
                        {matchResults[match.id] ? 'Update Result' : 'Add Result'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Add Result Modal */}
          <Modal show={showModal} onHide={() => setShowModal(false)}>
            <Modal.Header closeButton>
              <Modal.Title>Update Match Result</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {selectedMatch && (
                <Form>
                  <Form.Group className="mb-3">
                    <Form.Label>Winner</Form.Label>
                    <Form.Select 
                      value={result.winner}
                      onChange={(e) => setResult({...result, winner: e.target.value})}
                    >
                      <option value="">Select Winner</option>
                      {selectedMatch && getAllMatches().find(m => m.id === selectedMatch) && (
                        <>
                          <option value={getAllMatches().find(m => m.id === selectedMatch).player1}>
                            {getAllMatches().find(m => m.id === selectedMatch).player1}
                          </option>
                          <option value={getAllMatches().find(m => m.id === selectedMatch).player2}>
                            {getAllMatches().find(m => m.id === selectedMatch).player2}
                          </option>
                        </>
                      )}
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
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Close
              </Button>
              <Button variant="primary" onClick={handleSaveResult}>
                Save Result
              </Button>
            </Modal.Footer>
          </Modal>
        </div>
      </div>
    </div>
  );
};

export default Results;