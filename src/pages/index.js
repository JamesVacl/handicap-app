import { useState, useEffect } from 'react';
import { signUp, signIn, logOut, getCourses, getScoresForUser, getScores, addScore, addCourse } from 'src/firebase';

const Home = () => {
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpFirstName, setSignUpFirstName] = useState('');
  const [signUpLastName, setSignUpLastName] = useState('');
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [scores, setScores] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [score, setScore] = useState('');
  const [rating, setRating] = useState('');
  const [slope, setSlope] = useState('');
  const [newCourse, setNewCourse] = useState('');
  const [addingNewCourse, setAddingNewCourse] = useState(false);

  // Fetch courses and leaderboard for all users on page load (publicly available data)
  useEffect(() => {
    const fetchData = async () => {
      const scoreList = await getScores(); // Fetch all scores for the leaderboard and public display
      setScores(scoreList);
      const courseList = await getCourses();
      setCourses(courseList);

      // Calculate leaderboard after fetching scores
      const leaderboardData = calculateLeaderboard(scoreList);
      setLeaderboard(leaderboardData);
    };
    fetchData();
  }, []);

  // Handle Sign Up
  const handleSignUp = async (e) => {
    e.preventDefault();
    const newUser = await signUp(signUpEmail, signUpPassword, signUpFirstName, signUpLastName);
    setUser(newUser);
  };

  // Handle Sign In
  const handleSignIn = async (e) => {
    e.preventDefault();
    const loggedInUser = await signIn(signInEmail, signInPassword);
    setUser(loggedInUser);
  };

  // Handle Sign Out
  const handleSignOut = () => {
    logOut();
    setUser(null);
  };

  // Handle course selection
  const handleCourseSelect = (e) => {
    const selected = courses.find(course => course.course === e.target.value);
    setSelectedCourse(selected.course);
    setRating(selected.rating);
    setSlope(selected.slope);
  };

  // Handle form submission (only for signed-in users)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (addingNewCourse) {
      await addCourse({ course: newCourse, rating: parseFloat(rating), slope: parseFloat(slope) });
      alert("New course added!");
    } else if (user) {
      await addScore({ score: parseFloat(score), course: selectedCourse, rating: parseFloat(rating), slope: parseFloat(slope), user: user.email });
      alert("Score added!");

      // Refresh scores after submission
      const updatedScores = await getScoresForUser(user.email);
      setScores(updatedScores);
    } else {
      alert("You must be logged in to add a score.");
    }

    setScore('');
    setNewCourse('');
    setRating('');
    setSlope('');
    setAddingNewCourse(false);
  };

  // Calculate leaderboard based on the lowest 8 differentials from the most recent 20 scores
  const calculateLeaderboard = (scores) => {
    const userScores = {};
  
    // Group scores by user and collect their first and last name
    scores.forEach(score => {
      if (!userScores[score.user]) {
        userScores[score.user] = {
          firstName: score.firstName,
          lastName: score.lastName,
          differentials: []
        };
      }
      userScores[score.user].differentials.push(score.differential);
    });
  
    // Create the leaderboard
    const leaderboard = Object.keys(userScores).map(userEmail => {
      const { firstName, lastName, differentials } = userScores[userEmail];
      
      if (!firstName || !lastName) {
        return null;  // Skip if first name or last name is missing
      }
  
      const sortedDifferentials = differentials.sort((a, b) => a - b); // Sort from lowest to highest
      const lowestDifferentials = sortedDifferentials.slice(0, Math.min(8, differentials.length)); // Take the lowest 8 or fewer
      const averageHandicap = lowestDifferentials.reduce((acc, diff) => acc + diff, 0) / lowestDifferentials.length;
  
      return {
        name: `${firstName} ${lastName}`,
        handicap: parseFloat(averageHandicap.toFixed(2)) // Round to 2 decimal places
      };
    }).filter(item => item !== null); // Remove null values
  
    return leaderboard.sort((a, b) => a.handicap - b.handicap);
  };

  return (
    <div>
      <h1>Handicap Tracking</h1>

      {/* Sign-Up / Sign-In Form */}
      {!user ? (
        <div>
          <h2>Sign Up</h2>
          <form onSubmit={handleSignUp}>
            <input
              type="email"
              placeholder="Email"
              value={signUpEmail}
              onChange={(e) => setSignUpEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={signUpPassword}
              onChange={(e) => setSignUpPassword(e.target.value)}
            />
            <input
              type="text"
              placeholder="First Name"
              value={signUpFirstName}
              onChange={(e) => setSignUpFirstName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Last Name"
              value={signUpLastName}
              onChange={(e) => setSignUpLastName(e.target.value)}
            />
            <button type="submit">Sign Up</button>
          </form>

          <h2>Sign In</h2>
          <form onSubmit={handleSignIn}>
            <input
              type="email"
              placeholder="Email"
              value={signInEmail}
              onChange={(e) => setSignInEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={signInPassword}
              onChange={(e) => setSignInPassword(e.target.value)}
            />
            <button type="submit">Sign In</button>
          </form>
        </div>
      ) : (
        <div>
          <h2>Welcome, {user.firstName} {user.lastName}!</h2>
          <button onClick={handleSignOut}>Log Out</button>
        </div>
      )}

      {/* Leaderboard */}
      <h2>Leaderboard</h2>
      <ul>
        {leaderboard.length > 0 ? (
          leaderboard.map((entry, index) => (
            <li key={index}>
              {entry.name}: {entry.handicap}
            </li>
          ))
        ) : (
          <p>No leaderboard data available yet.</p>
        )}
      </ul>

      {/* Show the score submission form only if the user is logged in */}
      {user && (
        <form onSubmit={handleSubmit}>
          {!addingNewCourse ? (
            <>
              <label>Select a Course:</label>
              <select onChange={handleCourseSelect} value={selectedCourse}>
                <option value="">-- Choose a Course --</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.course}>
                    {course.course}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="New Course Name"
                value={newCourse}
                onChange={(e) => setNewCourse(e.target.value)}
              />
            </>
          )}

          <input
            type="number"
            placeholder="Course Rating"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            disabled={!addingNewCourse}
          />
          <input
            type="number"
            placeholder="Slope Rating"
            value={slope}
            onChange={(e) => setSlope(e.target.value)}
            disabled={!addingNewCourse}
          />
          <input
            type="number"
            placeholder="Score"
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />

          <button type="submit">
            {addingNewCourse ? "Add New Course" : "Submit Score"}
          </button>

          <button type="button" onClick={() => setAddingNewCourse(!addingNewCourse)}>
            {addingNewCourse ? "Cancel" : "Add a New Course"}
          </button>
        </form>
      )}

      {/* Displaying Previous Scores */}
      <h2>Previous Scores</h2>
      <ul>
        {scores.length > 0 ? (
          scores.map((score) => (
            <li key={score.id}>
              {score.user} - {score.course}: {score.score} (HDCP: {score.differential})
            </li>
          ))
        ) : (
          <p>No scores recorded yet.</p>
        )}
      </ul>
    </div>
  );
};

export default Home;