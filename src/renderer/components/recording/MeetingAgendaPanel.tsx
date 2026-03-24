/**
 * Meeting Agenda Panel Component
 *
 * Shows meeting checklist items during recording:
 * - Collapsible header with chevron
 * - Checkbox items with orange accent
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

// Clipboard check icon
function ClipboardCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13.333 3.333H15a1.667 1.667 0 011.667 1.667v11.667A1.667 1.667 0 0115 18.333H5a1.667 1.667 0 01-1.667-1.666V5a1.667 1.667 0 011.667-1.667h1.667"
        stroke="#EC5B16"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 1.667h-5A.833.833 0 006.667 2.5v1.667c0 .46.373.833.833.833h5c.46 0 .833-.373.833-.833V2.5a.833.833 0 00-.833-.833z"
        stroke="#EC5B16"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 10l1.667 1.667L12.5 8.333"
        stroke="#EC5B16"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface ChecklistItemProps {
  text: string;
  checked: boolean;
  onToggle: () => void;
}

function ChecklistItem({ text, checked, onToggle }: ChecklistItemProps) {
  return (
    <div
      className="bg-[#fff5ec] border border-[rgba(236,91,22,0.2)] rounded-[10px] px-[13px] py-[9px] flex items-center gap-[12px] cursor-pointer hover:bg-[#ffeddb] transition-colors w-full"
      onClick={onToggle}
    >
      {/* Checkbox */}
      <div
        className={`w-[16px] h-[16px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors ${
          checked
            ? 'bg-[#ec5b16] border border-[#ec5b16]'
            : 'bg-white border border-[#efefef]'
        }`}
      >
        {checked && <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />}
      </div>

      {/* Text */}
      <p
        className={`flex-1 text-[14px] leading-[24px] tracking-[0.07px] ${
          checked ? 'line-through text-[#969696]' : 'text-black'
        }`}
      >
        {text}
      </p>
    </div>
  );
}

interface MeetingAgendaPanelProps {
  checklist: string[];
  checkedItems?: Set<number>;
  onToggleItem?: (index: number) => void;
  defaultExpanded?: boolean;
}

export function MeetingAgendaPanel({
  checklist,
  checkedItems = new Set(),
  onToggleItem,
  defaultExpanded = true,
}: MeetingAgendaPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [localCheckedItems, setLocalCheckedItems] = useState<Set<number>>(checkedItems);

  const handleToggle = (index: number) => {
    if (onToggleItem) {
      onToggleItem(index);
    } else {
      setLocalCheckedItems((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(index)) {
          newSet.delete(index);
        } else {
          newSet.add(index);
        }
        return newSet;
      });
    }
  };

  const effectiveCheckedItems = onToggleItem ? checkedItems : localCheckedItems;

  if (checklist.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-[#efefef] rounded-[16px] p-[16px] flex flex-col gap-[20px]">
      {/* Header */}
      <div
        className="flex items-center gap-[6px] cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-1 flex items-center gap-[4px]">
          <ClipboardCheckIcon />
          <span className="font-medium text-[16px] text-black">Meeting Agenda</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-[24px] h-[24px] text-[#464646]" />
        ) : (
          <ChevronDown className="w-[24px] h-[24px] text-[#464646]" />
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="flex flex-col gap-[10px]">
          {checklist.map((item, idx) => (
            <ChecklistItem
              key={idx}
              text={item}
              checked={effectiveCheckedItems.has(idx)}
              onToggle={() => handleToggle(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MeetingAgendaPanel;
