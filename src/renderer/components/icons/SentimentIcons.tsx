/**
 * Sentiment Icons for Meeting Analysis
 *
 * Five sentiment states:
 * - Positive/Happy (green)
 * - Neutral (gray)
 * - Negative/Sad (red)
 * - Negative/Angry (red)
 * - Confused (yellow/orange)
 */

import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

export function HappyIcon({ size = 22, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="16" cy="16" r="14" stroke="#22c55e" strokeWidth="2" fill="none" />
      <circle cx="11" cy="13" r="2" fill="#22c55e" />
      <circle cx="21" cy="13" r="2" fill="#22c55e" />
      <path
        d="M10 20C10 20 12.5 24 16 24C19.5 24 22 20 22 20"
        stroke="#22c55e"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NeutralIcon({ size = 22, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="16" cy="16" r="14" stroke="#9ca3af" strokeWidth="2" fill="none" />
      <circle cx="11" cy="13" r="2" fill="#9ca3af" />
      <circle cx="21" cy="13" r="2" fill="#9ca3af" />
      <line x1="10" y1="21" x2="22" y2="21" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SadIcon({ size = 22, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="16" cy="16" r="14" stroke="#ef4444" strokeWidth="2" fill="none" />
      <circle cx="11" cy="13" r="2" fill="#ef4444" />
      <circle cx="21" cy="13" r="2" fill="#ef4444" />
      <path
        d="M10 24C10 24 12.5 20 16 20C19.5 20 22 24 22 24"
        stroke="#ef4444"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AngryIcon({ size = 22, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="16" cy="16" r="14" stroke="#ef4444" strokeWidth="2" fill="none" />
      <circle cx="11" cy="14" r="2" fill="#ef4444" />
      <circle cx="21" cy="14" r="2" fill="#ef4444" />
      <line x1="8" y1="10" x2="14" y2="12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="10" x2="18" y2="12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M10 24C10 24 12.5 20 16 20C19.5 20 22 24 22 24"
        stroke="#ef4444"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ConfusedIcon({ size = 22, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="16" cy="16" r="14" stroke="#eab308" strokeWidth="2" fill="none" />
      <circle cx="11" cy="13" r="2" fill="#eab308" />
      <circle cx="21" cy="13" r="2" fill="#eab308" />
      <path
        d="M11 22C11 22 13 19 16 21C19 23 21 20 21 20"
        stroke="#eab308"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export type SentimentType = 'happy' | 'neutral' | 'sad' | 'angry' | 'confused';

interface SentimentIconProps extends IconProps {
  sentiment: SentimentType;
}

export function SentimentIcon({ sentiment, ...props }: SentimentIconProps) {
  switch (sentiment) {
    case 'happy':
      return <HappyIcon {...props} />;
    case 'neutral':
      return <NeutralIcon {...props} />;
    case 'sad':
      return <SadIcon {...props} />;
    case 'angry':
      return <AngryIcon {...props} />;
    case 'confused':
      return <ConfusedIcon {...props} />;
    default:
      return <NeutralIcon {...props} />;
  }
}
