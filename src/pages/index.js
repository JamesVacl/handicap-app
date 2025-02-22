import { useState, useEffect } from 'react';
import { addScore, addCourse, getCourses } from 'src/firebase';


const Home = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [score, setScore] = useState('');
  const [rating, setRating] = useState('');
  const [slope, setSlope] = useState('');
  const [newCourse, setNewCourse] = useState('');
  const [addingNewCourse, setAddingNewCourse] = useState(false);

  // Fetch courses from Firestore when the page loads
  useEffect(() => {
    const fetchCourses = async () => {
      const courseList = await getCourses();
      setCourses(courseList);
    };
    fetchCourses();
  }, []);

  // Handle existing course selection
  const handleCourseSelect = (e) => {
    const selected = courses.find(course => course.course === e.target.value);
    setSelectedCourse(selected.course);
    setRating(selected.rating);
    setSlope(selected.slope);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (addingNewCourse) {
      await addCourse({ course: newCourse, rating: parseFloat(rating), slope: parseFloat(slope) });
      alert("New course added!");
    } else {
      await addScore({ score: parseFloat(score), course: selectedCourse, rating: parseFloat(rating), slope: parseFloat(slope) });
      alert("Score added!");
    }

    // Reset form
    setScore('');
    setNewCourse('');
    setRating('');
    setSlope('');
    setAddingNewCourse(false);
  };

  return (
    <div>
      <h1>Handicap Tracking</h1>
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
    </div>
  );
};

const handleCourseSelect = (e) => {
  const selected = courses.find(course => course.course === e.target.value);

  console.log("Selected course:", selected); // Debugging log

  if (selected) {
    setSelectedCourse(selected.course);
    setRating(selected.rating);
    setSlope(selected.slope);
  }
};

export default Home;