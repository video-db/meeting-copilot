/**
 * Live Assist Panel Component
 *
 * Shows real-time AI-generated assists during recording:
 * - Questions to ask (ask)
 * - Things to say (speak)
 * - Actions to take (act)
 *
 * Also shows MCP Findings section.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useLiveAssist } from '../../hooks/useLiveAssist';
import { useMCP } from '../../hooks/useMCP';
import type { LiveAssistItem } from '../../../shared/types/live-assist.types';

// Lightbulb icon for Live Assist
function LightbulbIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 2.5C6.54822 2.5 3.75 5.29822 3.75 8.75C3.75 10.9196 4.86607 12.8304 6.5625 13.9062V15.625C6.5625 16.3154 7.12214 16.875 7.8125 16.875H12.1875C12.8779 16.875 13.4375 16.3154 13.4375 15.625V13.9062C15.1339 12.8304 16.25 10.9196 16.25 8.75C16.25 5.29822 13.4518 2.5 10 2.5Z"
        stroke="#EC5B16"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7.5 17.5H12.5" stroke="#EC5B16" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Empty state icon
function EmptyInsightsIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M18 6L8 18H15L14 26L24 14H17L18 6Z"
        stroke="#969696"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface AssistItemProps {
  item: LiveAssistItem;
}

function AssistItem({ item }: AssistItemProps) {
  return (
    <div className="flex flex-col justify-center w-full">
      <ul>
        <li className="list-disc ms-[21px]">
          <span className="text-[14px] text-black leading-[22px]">{item.text}</span>
        </li>
      </ul>
    </div>
  );
}

export function LiveAssistPanel() {
  const { assists } = useLiveAssist();
  const { activeResults } = useMCP();

  // Get the latest MCP result for display
  const latestMCPResult = activeResults.length > 0 ? activeResults[activeResults.length - 1] : null;
  const mcpFindings = latestMCPResult?.content?.text || latestMCPResult?.content?.markdown || '';

  const hasAssists = assists.length > 0;

  return (
    <div className="bg-white border border-[#e4e4ec] rounded-[12px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.04),0px_1px_2px_0px_rgba(0,0,0,0.02)] p-[17px] flex flex-col gap-[20px]">
      {/* Header */}
      <div className="flex items-center gap-[6px]">
        <LightbulbIcon />
        <span className="font-medium text-[16px] text-black">Live Assist</span>
      </div>

      {/* Assists List */}
      <div className="bg-white rounded-[16px] max-h-[206px] min-h-[80px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {hasAssists ? (
          <div className="flex flex-col gap-[6px] text-[14px] text-black">
            {assists.map((assist) => (
              <AssistItem key={assist.id} item={assist} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[80px] text-center">
            <p className="text-[13px] text-[#969696]">
              AI suggestions will appear here as the conversation progresses
            </p>
          </div>
        )}
      </div>

      {/* MCP Findings Section */}
      <div className="border border-[#efefef] rounded-[12px] overflow-hidden">
        {/* MCP Findings Header */}
        <div className="bg-[#f7f7f7] border-b border-[#efefef] px-[16px] py-[12px]">
          <span className="font-medium text-[14px] text-black tracking-[0.07px]">
            MCP Findings
          </span>
        </div>

        {/* MCP Findings Content */}
        <div className="bg-white p-[16px]">
          {mcpFindings ? (
            <div className="prose prose-sm max-w-none text-[14px] text-black leading-[22px]">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      className="text-[#ec5b16] underline decoration-solid"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => <ul className="list-disc ml-5 mb-2">{children}</ul>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                }}
              >
                {mcpFindings}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-[16px] py-[14px]">
              <EmptyInsightsIcon />
              <p className="text-[13px] text-[#969696] text-center leading-[18.75px]">
                See live results triggered by conversation keywords
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LiveAssistPanel;
