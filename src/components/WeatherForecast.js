import { useState, useEffect } from 'react';
import axios from 'axios';

const WeatherForecast = ({ city = 'Owen Sound,CA' }) => {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await axios.get(
          `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY}&units=metric&cnt=40`
        );
        
        // Group forecasts by day
        const dailyForecasts = response.data.list.reduce((acc, forecast) => {
          const date = new Date(forecast.dt * 1000).toLocaleDateString();
          
          if (!acc[date]) {
            acc[date] = {
              ...forecast,
              popCount: 1,
              popSum: forecast.pop,
              main: {
                ...forecast.main,
                temp_min: forecast.main.temp,
                temp_max: forecast.main.temp
              }
            };
          } else {
            acc[date].main.temp_min = Math.min(acc[date].main.temp_min, forecast.main.temp);
            acc[date].main.temp_max = Math.max(acc[date].main.temp_max, forecast.main.temp);
            acc[date].popCount += 1;
            acc[date].popSum += forecast.pop;
          }
          return acc;
        }, {});

        const processedForecasts = Object.values(dailyForecasts)
          .map(forecast => ({
            ...forecast,
            pop: forecast.popSum / forecast.popCount
          }))
          .slice(0, 5);

        setForecasts(processedForecasts);
        setError(null);
      } catch (error) {
        console.error('Error fetching weather:', error);
        setError('Unable to load weather data');
      } finally {
        setLoading(false);
      }
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
              <div className="temp">
                <span className="high">{Math.round(forecast.main.temp_max)}°</span>
                <span className="low ms-2">{Math.round(forecast.main.temp_min)}°</span>
              </div>
              <div className="conditions">
                <span>{Math.round(forecast.wind.speed * 3.6)}km/h</span>
                <span className="precipitation ms-2">
                  {`${Math.round(forecast.pop * 100)}%`} {forecast.pop > 0 && '☔️'}
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