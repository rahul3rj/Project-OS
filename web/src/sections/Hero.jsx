import React from 'react'
import Navbar from '../components/Navbar'
import RippleButton from '../components/RippleButton'
import { useLiquidGlass } from '../utils/useLiquidGlass'

const Hero = () => {
  // Real liquid glass refraction for Add to Chrome button
  const chromeGlassRef = useLiquidGlass({
    scale: -90,
    chroma: 4,
    blur: 3,
    saturate: 1.6
  })

  return (
    <section id='hero' className='relative w-full min-h-screen flex flex-col justify-between overflow-hidden bg-black select-none'>
      {/* Full Cover Background Artwork (extended downwards to bleed into video section) */}
      <img
        src='/hero.png'
        alt='Hero Background'
        fetchPriority='high'
        loading='eager'
        decoding='async'
        className='absolute -top-0 inset-x-0 w-full h-[115%] object-cover object-top pointer-events-none'
      />

      {/* Smooth Bottom Bleed Gradient Blending into Video section */}
      <div className='absolute inset-x-0 -bottom-10 h-48 md:h-20 bg-gradient-to-b from-transparent via-black/60 to-black pointer-events-none z-10' />

      {/* Top Navbar */}
      <Navbar />

      {/* Main Hero Content Area */}
      <div className='relative z-10 w-full flex-1 flex flex-col justify-between px-4 sm:px-8 md:px-14 pb-12 pt-20 sm:pt-24 md:pt-18'>
        {/* Middle Row: Left Heading & Right Subtitle */}
        <div className='grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start mt-4 md:mt-8'>
          {/* Left Column: Tagline & Main Title */}
          <div className='lg:col-span-8 flex flex-col gap-2'>
            {/* Small Bullet Feature Line */}
            <p className='text-[10px] md:text-[11px] font-medium tracking-wide text-zinc-400'>
              Free & Open Source &nbsp;•&nbsp; Blazing Fast 0ms Startup &nbsp;•&nbsp; 100% Local Privacy
            </p>

            {/* Large Rejoice Heading */}
            <h1 className='text-4xl sm:text-6xl md:text-7xl lg:text-[4.5rem] font-rejoice font-light leading-[1.03] tracking-tight text-white drop-shadow-md'>
              The OS You<br />
              Was Always<br />
              Missing...
            </h1>
          </div>

          {/* Right Column: Narrative Subtitle */}
          <div className='lg:col-span-4 flex lg:justify-end pt-2 lg:pt-3'>
            <p className='text-xs md:text-[13px] text-zinc-300 font-light leading-relaxed max-w-[260px] lg:text-right drop-shadow-sm'>
              Turn Every Blank Tab Into Your Ultimate Productivity Command Center
            </p>
          </div>
        </div>

        {/* Bottom Bar: Action Buttons on the Right (Absolute Positioned on Desktop, Flowing on Mobile) */}
        <div className='relative mt-10 sm:mt-14 md:mt-0 md:absolute md:bottom-30 md:right-14 z-20 flex flex-wrap sm:flex-nowrap items-center gap-3'>
          {/* Add to Chrome Button with Real Liquid Glass */}
          <a
            ref={chromeGlassRef}
            href='#chrome-store'
            data-cursor='soon'
            className='liquid-glass liquid-glass-btn flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full text-white text-[10px] sm:text-[11px] font-syne font-bold uppercase transition-all duration-300 shadow-xl'
          >
            <span>ADD TO CHROME</span>
            <i className='ri-chrome-fill text-sm'></i>
          </a>

          {/* Download Zip Button (RippleButton) */}
          <RippleButton
            href='https://github.com/rahul3rj/Project-OS/releases/download/v2.5.0/ProjectOS.v2.5.0.zip'
            className='px-5 sm:px-6 py-2.5 sm:py-3 text-[10px] sm:text-[11px]'
          >
            <span>DOWNLOAD ZIP</span>
            <i className='ri-download-line text-sm font-bold' />
          </RippleButton>
        </div>
      </div>
    </section>
  )
}

export default Hero