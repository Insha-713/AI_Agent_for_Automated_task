import React from 'react';

export default function ParticleBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden transition-colors duration-300">
      {/* Soft, minimal ambient gradients - modern SaaS style */}
      <div className="absolute top-0 left-1/4 w-[40rem] h-[20rem] bg-cyan-500/[0.04] dark:bg-cyan-500/[0.03] rounded-full blur-[100px]" />
      <div className="absolute top-1/2 right-10 w-[30rem] h-[20rem] bg-indigo-500/[0.04] dark:bg-indigo-500/[0.03] rounded-full blur-[100px]" />

      {/* Subtle, crisp tech grid */}
      <div 
        className="absolute inset-0 opacity-[0.025] dark:opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />
    </div>
  );
}
