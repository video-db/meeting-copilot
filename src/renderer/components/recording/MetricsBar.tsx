/**
 * Metrics Bar Component
 *
 * Shows recording metrics:
 * - Talk ratio (You vs Them with progress bar)
 * - Health score with colored border
 * - Sentiment indicator
 */

import React from 'react';
import { useCopilotStore } from '../../stores/copilot.store';
import { SentimentIcon, type SentimentType } from '../icons/SentimentIcons';

export function MetricsBar() {
  const { metrics, healthScore, isCallActive } = useCopilotStore();

  const mePercent = metrics ? Math.round(metrics.talkRatio.me * 100) : 50;
  const themPercent = metrics ? Math.round(metrics.talkRatio.them * 100) : 50;

  // Determine health color (Figma colors)
  const getHealthBorderColor = () => {
    if (healthScore >= 70) return 'border-[#559e58]';
    if (healthScore >= 50) return 'border-[#eab308]';
    return 'border-[#ef4444]';
  };

  // Map health score to sentiment type
  const getSentimentType = (): SentimentType => {
    if (healthScore >= 70) return 'happy';
    if (healthScore >= 50) return 'neutral';
    if (healthScore >= 30) return 'sad';
    return 'angry';
  };

  return (
    <div className="flex items-center gap-[16px] h-[35px]">
      {/* Talk Ratio Pill */}
      <div className="bg-white border border-[#efefef] rounded-[40px] h-full px-[16px] py-[4px] flex items-center">
        <div className="flex items-center gap-[12px]">
          <span className="text-[14px] text-[#464646] tracking-[0.07px] whitespace-nowrap">
            You: {mePercent}%
          </span>
          {/* Progress bar */}
          <div className="w-[106px] h-[7px] bg-[#f0f0f5] rounded-[4px] overflow-hidden relative">
            {/* Me portion (orange) */}
            <div
              className="absolute top-0 left-0 h-full bg-[#ec5b16] rounded-l-[4px]"
              style={{ width: `${mePercent}%` }}
            />
            {/* Them portion (blue) */}
            <div
              className="absolute top-0 right-0 h-full bg-[#3b82f6] rounded-r-[4px]"
              style={{ width: `${themPercent}%` }}
            />
          </div>
          <span className="text-[14px] text-[#464646] tracking-[0.07px] whitespace-nowrap">
            Them: {themPercent}%
          </span>
        </div>
      </div>

      {/* Health Score Pill */}
      {isCallActive && (
        <div
          className={`bg-white border ${getHealthBorderColor()} rounded-[40px] px-[11px] py-[9px] flex items-center gap-[6px] w-[91px]`}
        >
          <span className="text-[14px] text-black tracking-[0.07px]">Health</span>
          <span className="font-semibold text-[14px] text-black text-right">{healthScore}</span>
        </div>
      )}

      {/* Sentiment Indicator */}
      {isCallActive && <SentimentIcon sentiment={getSentimentType()} size={22} />}
    </div>
  );
}

export default MetricsBar;
