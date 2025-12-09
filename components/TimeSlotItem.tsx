import React from 'react';
import { TimeSlot } from '../types';
import { THEME } from '../constants';
import { CheckCircle2, Clock } from 'lucide-react';
import { getContrastColor } from '../utils/colorUtils';

interface Props {
  slot: TimeSlot;
  onClick: (slot: TimeSlot) => void;
  isAlarmActive: boolean;
  categoryColors?: Record<string, string>;
}

export const TimeSlotItem: React.FC<Props> = ({ slot, onClick, isAlarmActive, categoryColors = {} }) => {
  const hasLog = !!slot.log;

  // Determine color
  // Priority: 1. Exact Category Match, 2. Description Match (if category fallback needed)
  const catKey = slot.log?.category || slot.log?.description.trim();
  const catColor = (hasLog && catKey) ? categoryColors[catKey] : undefined;

  // Determine Text Contrast
  const textColor = catColor ? getContrastColor(catColor) : undefined;

  let containerClass = "relative flex items-center p-3 mb-2 rounded-xl transition-all duration-200 cursor-pointer border ";
  let textClass = "";
  let timeClass = "text-xs font-mono font-medium mr-4 min-w-[3rem]";

  // Custom Styles objects
  const containerStyle: React.CSSProperties = {};

  if (isAlarmActive && slot.isCurrent) {
    // Alarm Style (High Priority)
    containerClass += "bg-red-50 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse ring-2 ring-red-400 ";
    textClass += "text-red-900 font-bold";
    timeClass += "text-red-700 font-bold";
  } else if (hasLog) {
    // Logged Slot
    if (catColor) {
      // Custom colored slot
      containerStyle.backgroundColor = catColor;
      containerStyle.color = textColor;
      containerClass += "border-transparent shadow-sm hover:shadow-md ";

      // Text contrast enforcement
      textClass += "font-medium ";

      // Time color should also match or contrast
      const isTextWhite = textColor === '#ffffff';
      timeClass += isTextWhite ? "text-white/70" : "text-black/60";

    } else {
      // Default filled slot (no color assigned)
      containerClass += `${THEME.slotFilled} border-transparent shadow-sm hover:shadow-md`;
      textClass += "font-medium text-indigo-900";
      timeClass += " text-indigo-700/70";
    }
  } else if (slot.isCurrent) {
    // Current Empty Slot
    containerClass += "bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500";
    textClass += "text-gray-400 italic";
    timeClass += " text-indigo-600 font-bold";
  } else {
    // Past/Future Empty Slot
    containerClass += "bg-white border-gray-100 hover:border-gray-300";
    textClass += "text-gray-300 italic";
    timeClass += " text-gray-400";
  }

  return (
    <div
      className={containerClass}
      style={containerStyle}
      onClick={() => onClick(slot)}
      id={`slot-${slot.timestamp}`}
    >
      <div className={timeClass}>
        {slot.timeLabel}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Main Description */}
          <span className={`truncate ${textClass}`} style={textColor ? { color: textColor } : {}}>
            {hasLog ? slot.log?.description : isAlarmActive ? "LOG NOW!" : "Empty slot"}
          </span>
        </div>
      </div>

      <div className="ml-2">
        {hasLog ? (
          <CheckCircle2 size={16} className={catColor ? (textColor === '#ffffff' ? 'text-white/80' : 'text-black/50') : "text-indigo-500"} />
        ) : slot.isCurrent ? (
          <div className="flex items-center gap-1 text-xs text-indigo-500 font-bold animate-pulse">
            <Clock size={14} />
          </div>
        ) : null}
      </div>
    </div>
  );
};
