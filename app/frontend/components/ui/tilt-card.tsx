'use client'

import React from 'react'
import Tilt from 'react-parallax-tilt'

interface TiltCardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function TiltCard({ children, className = '', onClick }: TiltCardProps) {
  return (
    <Tilt
      tiltMaxAngleX={15}
      tiltMaxAngleY={15}
      perspective={1000}
      scale={1.02}
      transitionSpeed={400}
      gyroscope={true}
      className={className}
    >
      <div onClick={onClick} className="w-full h-full">
        {children}
      </div>
    </Tilt>
  )
}
