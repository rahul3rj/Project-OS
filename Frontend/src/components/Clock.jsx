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
    let active = true
    let retryTimeout = null

    const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast'

    const fetchWeather = async (lat, lon, retries = 3) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 8000)
          const res = await fetch(
            `${WEATHER_URL}?latitude=${lat}&longitude=${lon}&current_weather=true`,
            { signal: controller.signal }
          )
          clearTimeout(timer)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          if (data?.current_weather && active) {
            const temp = Math.round(data.current_weather.temperature)
            const emoji = weatherCodeToEmoji(data.current_weather.weathercode)
            setWeather({ temp, emoji, loaded: true })
          }
          return
        } catch {
          if (!active) return
          if (attempt < retries) {
            await new Promise(r => { retryTimeout = setTimeout(r, 2000 * attempt) })
          }
        }
      }
    }

    const fallbackCoords = { lat: 28.6139, lon: 77.209 }

    const gotPosition = (pos) => {
      if (!active) return
      fetchWeather(pos.coords.latitude, pos.coords.longitude)
    }

    const useFallback = () => {
      if (!active) return
      fetchWeather(fallbackCoords.lat, fallbackCoords.lon)
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(gotPosition, useFallback, { timeout: 8000 })
    } else {
      useFallback()
    }

    return () => {
      active = false
      if (retryTimeout) clearTimeout(retryTimeout)
    }
  }, [])

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
          style={{ color: 'var(--theme-1, #CBD5E1)' }}
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