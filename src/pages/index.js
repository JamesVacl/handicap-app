import { useState } from 'react';
import { addScore } from 'src/firebase';

const Home = () => {
  const [score, setScore] = useState('');
  const [course, setCourse] = useState('');
  const [rating, setRating] = useState('');
  const [slope, setSlope] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const scoreData = {
      score,
      course,
      rating: parseFloat(rating),
      slope: parseFloat(slope),
      date: new Date(),
    };
    await addScore(scoreData);
    alert("Score added!");
  };

  return (
    <div>
      <h1>Handicap Tracking</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Course Name"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        />
        <input
          type="number"
          placeholder="Score"
          value={score}
          onChange={(e) => setScore(e.target.value)}
        />
        <input
          type="number"
          placeholder="Course Rating"
          value={rating}
          onChange={(e) => setRating(e.target.value)}
        />
        <input
          type="number"
          placeholder="Slope Rating"
          value={slope}
          onChange={(e) => setSlope(e.target.value)}
        />
        <button type="submit">Submit Score</button>
      </form>
    </div>
  );
};

export default Home;