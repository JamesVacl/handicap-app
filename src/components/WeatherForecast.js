import { useState, useEffect } from 'react';
import axios from 'axios';

const WeatherForecast = ({ city = 'Owen Sound,CA' }) => {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Always fetch weather starting from current date
        const response = await axios.get(
          `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY}&units=metric&cnt=40`
        );
        
        // Group forecasts by day and keep the highest POP value
        const dailyForecasts = response.data.list.reduce((acc, forecast) => {
          const date = new Date(forecast.dt * 1000).toLocaleDateString();
          if (!acc[date] || forecast.pop > acc[date].pop) {
            acc[date] = forecast;
          }
          return acc;
        }, {});

        const processedForecasts = Object.values(dailyForecasts).slice(0, 5);
        setForecasts(processedForecasts);
        setError(null);
      } catch (error) {
        console.error('Error fetching weather:', error);
        setError('Unable to load weather data');
      }
      setLoading(false);
    };

    fetchWeather();
  }, [city]);

  if (loading) return <div>Loading weather...</div>;
  if (error) return <div className="text-danger">{error}</div>;
  if (!forecasts.length) return null;

  return (
    <div className="weather-forecast">
      {forecasts.map((forecast, index) => (
        <div key={index} className="forecast-day">
          <div className="forecast-header">
            {new Date(forecast.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' })}
          </div>
          <div className="forecast-content">
            <img 
              src={`https://openweathermap.org/img/w/${forecast.weather[0].icon}.png`}
              alt={forecast.weather[0].description}
              width={30}
              height={30}
            />
            <div className="forecast-details">
              <div className="temp">{Math.round(forecast.main.temp)}°C</div>
              <div className="conditions">
                <span>{Math.round(forecast.wind.speed * 3.6)}km/h</span>
                <span className="precipitation ms-2">
                  {/* Remove conditional rendering and always show POP */}
                  {Math.round(forecast.pop * 100)}% ☔️
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default WeatherForecast;