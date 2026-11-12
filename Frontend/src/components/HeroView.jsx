import React from 'react'

const HeroView = ({ shortcuts = [], onStart, isVisible = true }) => {
  return (
    <div inert={!isVisible} className='absolute inset-0 pointer-events-none z-40'>
      {/* Right Side Vertical Dock of Quick Shortcuts */}
      <div
        className={`absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-3.5 pointer-events-auto z-40 awwwards-motion ${
          isVisible ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-16 opacity-0 scale-90'
        }`}
      >
        {shortcuts
          .filter((s) => s && typeof s.url === 'string' && s.url.trim())
          .slice(0, 6)
          .map((s) => (
            <a
              key={s.id || s.url}
              href={s.url}
              className='figma-glass-card h-[6.5vh] w-[6.5vh] min-h-[42px] min-w-[42px] rounded-full flex items-center justify-center text-white cursor-pointer transition-all'
              title={s.title || s.url}
            >
              {s.iconDataUrl || s.iconUrl ? (
                <img src={s.iconDataUrl || s.iconUrl} alt={s.title || ''} className='h-[3vh] w-[3vh] min-h-[20px] min-w-[20px] object-contain relative z-10' />
              ) : s.iconClass ? (
                <i className={`${s.iconClass} text-[2.8vh] text-white relative z-10`}></i>
              ) : (
                <i className='ri-link text-[2.8vh] text-white relative z-10'></i>
              )}
            </a>
          ))}
      </div>

      {/* Bottom Right START > Button (Highest Z-Index) */}
      <div
        className={`absolute bottom-10 right-10 pointer-events-auto z-50 awwwards-motion ${
          isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-90'
        }`}
      >
        <button
          type='button'
          onClick={onStart}
          className='xp-start-button figma-glass-card px-15 py-3 rounded-full text-white font-gilroy-bold text-sm tracking-wider flex items-center gap-2 cursor-pointer transition-all relative z-50 shadow-2xl'
        >
          <span className='relative z-10'>START</span>
          <i className='ri-arrow-right-s-line text-lg relative z-10'></i>
        </button>
      </div>
    </div>
  )
}

export default HeroView
