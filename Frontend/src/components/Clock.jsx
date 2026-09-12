import React, { useEffect, useMemo, useState } from 'react'

const weatherCodeToEmoji = (code) => {
  if (code === 0) return '☀️'
  if (code >= 1 && code <= 3) return '⛅'
  if (code === 45 || code === 48) return '🌫️'
  if (code >= 51 && code <= 67) return '🌧️'
  if (code >= 71 && code <= 77) return '❄️'
  if (code >= 80 && code <= 82) return '🌧️'
  if (code >= 95 && code <= 99) return '🌩️'
  return '☀️'
}

const Clock = ({ isDashboard = false }) => {
  const [now, setNow] = useState(() => new Date())
  const [weather, setWeather] = useState({ temp: 22, emoji: '☀️', loaded: false })

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const intervalId = setInterval(tick, 1000)
    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    let active = true;

    const fetchWeather = async (lat, lon) => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );
        const data = await res.json();
        if (data?.current_weather && active) {
          const temp = Math.round(data.current_weather.temperature);
          const emoji = weatherCodeToEmoji(data.current_weather.weathercode);
          setWeather({ temp, emoji, loaded: true });
        }
      } catch (err) {
        console.warn('Weather fetch failed, using fallback:', err);
      }
    };

    const loadWeather = () => {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!active) return;
            fetchWeather(pos.coords.latitude, pos.coords.longitude);
          },
          () => {
            if (!active) return;
            fetchWeather(28.6139, 77.209);
          },
          { timeout: 8000 }
        );
      } else {
        fetchWeather(28.6139, 77.209);
      }
    };

    loadWeather();
    // Refresh weather every 30 minutes
    const weatherIntervalId = setInterval(loadWeather, 30 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(weatherIntervalId);
    };
  }, []);

  const hoursMinutes = useMemo(() => {
    const h = String(now.getHours()).padStart(2, '0')
    const m = String(now.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }, [now])

  const topDateStr = useMemo(() => {
    const day = now.getDate()
    const month = now.toLocaleString('en-US', { month: 'short' }).toUpperCase()
    return `${day} ${month}`
  }, [now])

  const bottomDateStr = useMemo(() => {
    const weekday = now.toLocaleString('en-US', { weekday: 'long' })
    const year = now.getFullYear()
    return `${weekday} ${year}`
  }, [now])

  return (
    <div
      className={`absolute left-5 bottom-5 pointer-events-auto z-20 select-none origin-bottom-left awwwards-motion transition-all duration-700 ease-out ${
        isDashboard ? 'scale-[0.60]' : 'scale-100'
      }`}
    >
      <div className='flex flex-col items-start'>
        {/* Top Date e.g. 4 AUG - 1st bright theme color */}
        <div
          className='text-xl md:text-2xl tracking-widest drop-shadow-md font-gilroy-bold uppercase z-10 pl-1'
          style={{ color: 'var(--theme-1, #CBD5E1)' }}
        >
          {topDateStr}
        </div>

        {/* Giant Digital Clock */}
        <h1 className='text-[50vh] leading-[0.69] font-bold drop-shadow-2xl font-heathergreen text-white'>
          {hoursMinutes}
        </h1>

        {/* Bottom Date & Live Weather - 2nd darkest theme color */}
        <div
          className='flex items-center gap-4 mt-[5vh] text-lg font-medium drop-shadow-md pl-1 font-gilroy-medium w-full justify-between'
          style={{ color: 'var(--theme-3, #334155)' }}
        >
          <span>{bottomDateStr}</span>
          <div className='flex items-center gap-1.5 px-3 py-1 text-lg'>
            <span>{weather.emoji}</span>
            <span>{weather.temp}°C</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Clock