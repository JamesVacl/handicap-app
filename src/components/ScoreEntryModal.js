import { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col, Badge } from 'react-bootstrap';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

const ScoreEntryModal = ({ show, onHide, match, onSave }) => {
  const [currentHole, setCurrentHole] = useState(1);
  const [holeResults, setHoleResults] = useState({});
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show && match) {
      setMatchData(match);
      // Initialize hole results from existing data
      if (match.currentScore?.holeResults) {
        setHoleResults(match.currentScore.holeResults);
        setCurrentHole(Object.keys(match.currentScore.holeResults).length + 1);
      } else {
        setHoleResults({});
        setCurrentHole(1);
      }
    }
  }, [show, match]);

  const handleHoleResult = (hole, result) => {
    setHoleResults(prev => ({
      ...prev,
      [hole]: {
        number: hole,
        result: result,
        timestamp: new Date()
      }
    }));
  };

  const calculateMatchScore = () => {
    if (matchData?.matchType === 'championship') {
      let team1Wins = 0;
      let team2Wins = 0;
      
      Object.values(holeResults).forEach(hole => {
        if (hole.result === 'team1_win') {
          team1Wins++;
        } else if (hole.result === 'team2_win') {
          team2Wins++;
        }
        // Ties don't change the score
      });

      return {
        team1Wins,
        team2Wins,
        holesPlayed: Object.keys(holeResults).length,
        holeResults,
        recentHoles: Object.values(holeResults).slice(-6)
      };
    } else {
      // Regular match format
      let player1Score = 0;
      let player2Score = 0;
      
      Object.values(holeResults).forEach(hole => {
        if (hole.result === 'player1_win') {
          player1Score++;
        } else if (hole.result === 'player2_win') {
          player2Score++;
        }
        // Ties don't change the score
      });

      return {
        player1Score,
        player2Score,
        holesPlayed: Object.keys(holeResults).length,
        holeResults,
        recentHoles: Object.values(holeResults).slice(-6)
      };
    }
  };

  const handleSaveScore = async () => {
    if (!matchData) return;
    
    setLoading(true);
    try {
      const db = getFirestore();
      const newScore = calculateMatchScore();
      
      // Determine match status
      let status = 'in_progress';
      const holesRemaining = 18 - newScore.holesPlayed;
      const maxPossibleScore = Math.max(newScore.player1Score, newScore.player2Score);
      const minPossibleScore = Math.min(newScore.player1Score, newScore.player2Score);
      
      // Check for early completion (mathematically impossible to come back)
      if (newScore.holesPlayed >= 18) {
        status = 'completed';
      } else if (maxPossibleScore > 9) {
        status = 'completed';
      } else if (maxPossibleScore - minPossibleScore > holesRemaining) {
        // If the difference is greater than holes remaining, match is over
        status = 'completed';
      }

      const updatedMatch = {
        ...matchData,
        currentScore: newScore,
        status: status,
        lastUpdate: new Date()
      };

      // Save to live matches
      await setDoc(doc(db, 'liveMatches', '2025'), {
        [matchData.id]: updatedMatch
      }, { merge: true });

      // If match is completed, move to history
      if (status === 'completed') {
        const finalScore = newScore.player1Score > newScore.player2Score ? 
          `${newScore.player1Score}&${newScore.player2Score}` : 
          `${newScore.player2Score}&${newScore.player1Score}`;
        
        const winner = newScore.player1Score > newScore.player2Score ? 
          matchData.player1 : matchData.player2;
        const loser = newScore.player1Score > newScore.player2Score ? 
          matchData.player2 : matchData.player1;

        await setDoc(doc(db, 'matchHistory', '2025'), {
          [matchData.id]: {
            courseName: matchData.courseName,
            date: matchData.date,
            teeTime: matchData.teeTime,
            player1: matchData.player1,
            player2: matchData.player2,
            winner: winner,
            loser: loser,
            finalScore: finalScore,
            duration: '4h 15m', // TODO: Calculate actual duration
            completedAt: new Date()
          }
        }, { merge: true });

        // Remove from live matches
        await setDoc(doc(db, 'liveMatches', '2025'), {
          [matchData.id]: null
        }, { merge: true });
      }

      onSave(updatedMatch);
      onHide();
    } catch (error) {
      console.error('Error saving score:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHoleResultBadge = (hole) => {
    const result = holeResults[hole];
    if (!result) return null;
    
    let variant, text;
    
    if (matchData?.matchType === 'championship') {
      variant = result.result === 'team1_win' ? 'success' : 
                result.result === 'team2_win' ? 'danger' : 'secondary';
      
      // Show specific player matchup if available
      const holeAssignment = matchData?.holeAssignments?.[hole];
      if (holeAssignment) {
        text = result.result === 'team1_win' ? `${holeAssignment.team1} wins` :
               result.result === 'team2_win' ? `${holeAssignment.team2} wins` : 'Tie';
      } else {
        text = result.result === 'team1_win' ? `${matchData?.team1?.name || 'Putt Pirates'} win` :
               result.result === 'team2_win' ? `${matchData?.team2?.name || 'Golden Boys'} win` : 'Tie';
      }
    } else if (matchData?.matchType === 'alternating') {
      variant = result.result === 'player1_win' ? 'success' : 
                result.result === 'player2_win' ? 'danger' : 'secondary';
      
      text = result.result === 'player1_win' ? `${matchData?.soloPlayer} wins` :
             result.result === 'player2_win' ? `${matchData?.team2Players?.join(' & ')} win` : 'Tie';
    } else {
      variant = result.result === 'player1_win' ? 'success' : 
                result.result === 'player2_win' ? 'danger' : 'secondary';
      
      text = result.result === 'player1_win' ? `${matchData?.player1} wins` :
             result.result === 'player2_win' ? `${matchData?.player2} wins` : 'Tie';
    }
    
    return <Badge bg={variant} className="ms-2">{text}</Badge>;
  };

  const getCurrentScore = () => {
    const score = calculateMatchScore();
    
    if (matchData?.matchType === 'championship') {
      const diff = score.team1Wins - score.team2Wins;
      
      if (diff === 0) return 'All Square';
      if (diff > 0) {
        return `${matchData.team1?.name || 'Putt Pirates'} ${diff}UP`;
      } else {
        return `${matchData.team2?.name || 'Golden Boys'} ${Math.abs(diff)}UP`;
      }
    } else {
      // Regular match format
      const diff = score.player1Score - score.player2Score;
      
      if (diff === 0) return 'All Square';
      if (diff > 0) {
        // Player 1 is up
        if (matchData?.matchType === 'alternating') {
          return `${matchData.soloPlayer} ${diff}UP`;
        } else {
          return `${matchData.player1} ${diff}UP`;
        }
      } else {
        // Player 2 is up
        if (matchData?.matchType === 'alternating') {
          return `${matchData.team2Players?.join(' & ')} ${Math.abs(diff)}UP`;
        } else {
          return `${matchData.player2} ${Math.abs(diff)}UP`;
        }
      }
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered className="score-entry-modal">
      <Modal.Header closeButton className="bg-success text-white">
        <Modal.Title>Update Match Score</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {matchData && (
          <div>
            {/* Match Info */}
            <div className="match-info mb-4 p-3 bg-light rounded">
              <h5 className="mb-2">{matchData.courseName}</h5>
              <p className="text-muted mb-2">
                {matchData.date} • {matchData.teeTime}
              </p>
                             {matchData.matchType === 'championship' ? (
                               // Championship format display
                               <div className="d-flex justify-content-between align-items-center">
                                 <div>
                                   <div className="d-flex flex-column">
                                     <span className="fw-bold">
                                       {matchData.team1?.name || 'Putt Pirates'}
                                     </span>
                                     <small className="text-muted">
                                       {matchData.team1?.players?.join(', ') || 'No players assigned'}
                                     </small>
                                   </div>
                                   <span className="mx-2">vs</span>
                                   <div className="d-flex flex-column">
                                     <span className="fw-bold">
                                       {matchData.team2?.name || 'Golden Boys'}
                                     </span>
                                     <small className="text-muted">
                                       {matchData.team2?.players?.join(', ') || 'No players assigned'}
                                     </small>
                                   </div>
                                 </div>
                                 <Badge bg="success" className="fs-6">
                                   {getCurrentScore()}
                                 </Badge>
                               </div>
                             ) : (
                               // Regular match format display
                               <div className="d-flex justify-content-between align-items-center">
                                 <div>
                                   <div className="d-flex flex-column">
                                     <span className="fw-bold">
                                       {matchData.matchType === 'alternating' ? matchData.soloPlayer : matchData.player1}
                                     </span>
                                     <small className="text-muted">
                                       {matchData.matchType === 'alternating' ? matchData.soloPlayerTeam : matchData.player1Team}
                                     </small>
                                   </div>
                                   <span className="mx-2">vs</span>
                                   <div className="d-flex flex-column">
                                     <span className="fw-bold">
                                       {matchData.matchType === 'alternating' ? matchData.team2Players?.join(' & ') : matchData.player2}
                                     </span>
                                     <small className="text-muted">
                                       {matchData.matchType === 'alternating' ? 
                                         matchData.team2PlayerTeams?.join(' & ') : matchData.player2Team}
                                     </small>
                                   </div>
                                 </div>
                                 <Badge bg="success" className="fs-6">
                                   {getCurrentScore()}
                                 </Badge>
                               </div>
                             )}
            </div>

            {/* Current Hole Entry */}
            <div className="current-hole-entry mb-4">
              <h6 className="mb-3">Hole {currentHole} Result</h6>
              
              {/* Show hole assignment for championship matches */}
              {matchData?.matchType === 'championship' && matchData?.holeAssignments?.[currentHole] && (
                <div className="hole-assignment mb-3 p-2 bg-light rounded">
                  <small className="text-muted">Hole {currentHole} Matchup:</small>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-success">
                      {matchData.holeAssignments[currentHole].team1}
                    </span>
                    <span className="text-muted">vs</span>
                    <span className="fw-bold text-danger">
                      {matchData.holeAssignments[currentHole].team2}
                    </span>
                  </div>
                </div>
              )}
                             {matchData.matchType === 'championship' ? (
                               // Championship format buttons
                               <Row>
                                 <Col xs={4}>
                                   <Button
                                     variant="outline-success"
                                     className="w-100 mb-2"
                                     onClick={() => handleHoleResult(currentHole, 'team1_win')}
                                     active={holeResults[currentHole]?.result === 'team1_win'}
                                   >
                                     {matchData?.holeAssignments?.[currentHole]?.team1 || matchData.team1?.name || 'Putt Pirates'} Wins
                                   </Button>
                                 </Col>
                                 <Col xs={4}>
                                   <Button
                                     variant="outline-secondary"
                                     className="w-100 mb-2"
                                     onClick={() => handleHoleResult(currentHole, 'tie')}
                                     active={holeResults[currentHole]?.result === 'tie'}
                                   >
                                     Tie
                                   </Button>
                                 </Col>
                                 <Col xs={4}>
                                   <Button
                                     variant="outline-danger"
                                     className="w-100 mb-2"
                                     onClick={() => handleHoleResult(currentHole, 'team2_win')}
                                     active={holeResults[currentHole]?.result === 'team2_win'}
                                   >
                                     {matchData?.holeAssignments?.[currentHole]?.team2 || matchData.team2?.name || 'Golden Boys'} Wins
                                   </Button>
                                 </Col>
                               </Row>
                             ) : (
                               // Regular match format buttons
                               <Row>
                                 <Col xs={4}>
                                   <Button
                                     variant="outline-success"
                                     className="w-100 mb-2"
                                     onClick={() => handleHoleResult(currentHole, 'player1_win')}
                                     active={holeResults[currentHole]?.result === 'player1_win'}
                                   >
                                     {matchData.matchType === 'alternating' ? matchData.soloPlayer : matchData.player1} Wins
                                   </Button>
                                 </Col>
                                 <Col xs={4}>
                                   <Button
                                     variant="outline-secondary"
                                     className="w-100 mb-2"
                                     onClick={() => handleHoleResult(currentHole, 'tie')}
                                     active={holeResults[currentHole]?.result === 'tie'}
                                   >
                                     Tie
                                   </Button>
                                 </Col>
                                 <Col xs={4}>
                                   <Button
                                     variant="outline-danger"
                                     className="w-100 mb-2"
                                     onClick={() => handleHoleResult(currentHole, 'player2_win')}
                                     active={holeResults[currentHole]?.result === 'player2_win'}
                                   >
                                     {matchData.matchType === 'alternating' ? matchData.team2Players?.join(' & ') : matchData.player2} Wins
                                   </Button>
                                 </Col>
                               </Row>
                             )}
              
              {holeResults[currentHole] && (
                <div className="text-center mt-2">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => setCurrentHole(prev => prev + 1)}
                  >
                    Next Hole ({currentHole + 1})
                  </Button>
                </div>
              )}
            </div>

            {/* Hole History */}
            {Object.keys(holeResults).length > 0 && (
              <div className="hole-history">
                <h6 className="mb-3">Hole History</h6>
                <div className="d-flex flex-wrap gap-2">
                  {Object.keys(holeResults).sort((a, b) => parseInt(a) - parseInt(b)).map(hole => (
                    <div key={hole} className="hole-item">
                      <small className="text-muted d-block">Hole {hole}</small>
                      {getHoleResultBadge(hole)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="quick-actions mt-4 pt-3 border-top">
              <h6 className="mb-3">Quick Actions</h6>
              <Row>
                <Col xs={6}>
                  <Button
                    variant="outline-warning"
                    size="sm"
                    className="w-100 mb-2"
                    onClick={() => {
                      // Go back to previous hole
                      if (currentHole > 1) {
                        setCurrentHole(prev => prev - 1);
                      }
                    }}
                    disabled={currentHole <= 1}
                  >
                    Previous Hole
                  </Button>
                </Col>
                <Col xs={6}>
                  <Button
                    variant="outline-info"
                    size="sm"
                    className="w-100 mb-2"
                    onClick={() => {
                      // Jump to specific hole
                      const hole = prompt('Enter hole number (1-18):');
                      if (hole && hole >= 1 && hole <= 18) {
                        setCurrentHole(parseInt(hole));
                      }
                    }}
                  >
                    Jump to Hole
                  </Button>
                </Col>
              </Row>
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button 
          variant="success" 
          onClick={handleSaveScore}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Score'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ScoreEntryModal; 