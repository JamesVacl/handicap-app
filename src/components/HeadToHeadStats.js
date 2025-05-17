import { useState, useEffect } from 'react';

const HeadToHeadStats = ({ matches, matchResults }) => {
  const [h2hRecords, setH2hRecords] = useState({});

  useEffect(() => {
    const calculateH2H = () => {
      if (!matches || !matchResults) {
        console.log('Missing data:', { matches, matchResults });
        return;
      }

      const records = {};
      
      // Ensure matches is an array
      const matchesArray = Array.isArray(matches) ? matches : [];
      
      matchesArray.forEach(match => {
        // Skip if no match data or result
        if (!match?.id || !match?.player1 || !match?.player2) {
          console.log('Invalid match data:', match);
          return;
        }

        const result = matchResults[match.id];
        if (!result?.winner) {
          console.log('No result for match:', match.id);
          return;
        }

        const player1 = match.player1;
        const player2 = match.player2;
        const winner = result.winner;

        const pairKey = [player1, player2].sort().join('_vs_');
        
        if (!records[pairKey]) {
          records[pairKey] = {
            players: [player1, player2].sort(),
            [player1]: 0,
            [player2]: 0,
            matches: 0
          };
        }

        records[pairKey][winner]++;
        records[pairKey].matches++;
      });

      console.log('Final records:', records);
      setH2hRecords(records);
    };

    calculateH2H();
  }, [matches, matchResults]);

  return (
    <div className="head-to-head-stats mb-4 p-4 border rounded bg-light">
      <h3 className="mb-3">Head-to-Head Records</h3>
      {Object.entries(h2hRecords).length === 0 ? (
        <p className="text-muted">No match results available</p>
      ) : (
        Object.entries(h2hRecords)
          .sort(([, a], [, b]) => b.matches - a.matches)
          .map(([pairKey, record]) => {
            const [player1, player2] = record.players;
            return (
              <div key={pairKey} className="h2h-record mb-3 p-2 border-bottom">
                <div className="d-flex justify-content-between align-items-center">
                  <div className="text-center" style={{ width: '40%' }}>
                    <span className={record[player1] > record[player2] ? 'fw-bold text-success' : ''}>
                      {player1}
                    </span>
                  </div>
                  <div className="text-center" style={{ width: '20%' }}>
                    <span className="mx-2">
                      {record[player1]}-{record[player2]}
                    </span>
                  </div>
                  <div className="text-center" style={{ width: '40%' }}>
                    <span className={record[player2] > record[player1] ? 'fw-bold text-success' : ''}>
                      {player2}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
      )}
    </div>
  );
};

export default HeadToHeadStats;