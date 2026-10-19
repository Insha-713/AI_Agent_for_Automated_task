import React from 'react';

export default function ParticleBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      {/* Radial Gradient Glow Orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-600/15 rounded-full blur-[120px] animate-pulse-slow" />
      <div className="absolute top-1/3 -right-40 w-[30rem] h-[30rem] bg-violet-600/15 rounded-full blur-[140px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
      <div className="absolute -bottom-40 left-1/3 w-[26rem] h-[26rem] bg-emerald-600/10 rounded-full blur-[130px] animate-pulse-slow" style={{ animationDelay: '4s' }} />

      {/* Subtle tech grid lines */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }}
      />
    </div>
  );
}
