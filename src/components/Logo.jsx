import React from 'react';

export default function Logo({ size = 38, className = '' }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* 3x3 Grid of rounded data cells */}
      <rect x="15" y="15" width="16" height="16" rx="4" fill="var(--text-primary)" opacity="0.25" />
      <rect x="42" y="15" width="16" height="16" rx="4" fill="var(--text-primary)" opacity="0.25" />
      <rect x="69" y="15" width="16" height="16" rx="4" fill="var(--text-primary)" opacity="0.25" />

      <rect x="15" y="42" width="16" height="16" rx="4" fill="var(--text-primary)" opacity="0.25" />
      <rect x="42" y="42" width="16" height="16" rx="4" fill="var(--text-primary)" opacity="0.25" />
      <rect x="69" y="42" width="16" height="16" rx="4" fill="var(--text-primary)" opacity="0.25" />

      <rect x="15" y="69" width="16" height="16" rx="4" fill="var(--text-primary)" opacity="0.25" />
      <rect x="42" y="69" width="16" height="16" rx="4" fill="var(--text-primary)" opacity="0.25" />
      <rect x="69" y="69" width="16" height="16" rx="4" fill="var(--text-primary)" opacity="0.25" />

      {/* The Fjord (Flowing diagonal wave representing clean water) */}
      <path 
        d="M 10,25 C 40,10 20,90 50,75 C 80,60 60,95 90,80" 
        fill="none" 
        stroke="var(--brand-primary)" 
        strokeWidth="10" 
        strokeLinecap="round"
      />
      <path 
        d="M 10,25 C 40,10 20,90 50,75 C 80,60 60,95 90,80" 
        fill="none" 
        stroke="#ffffff" 
        strokeWidth="2" 
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}
