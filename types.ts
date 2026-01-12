export interface LogEntry {
  id: string;
  timestamp: number;
  description: string;
  category?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface AppSettings {
  startHour: number;
  endHour: number;
  notificationsEnabled: boolean;
  visualFlashEnabled: boolean;
  soundId: string;
  muteUntil?: number;
  categoryColors?: Record<string, string>; // Legacy support, optional now
  categories: Category[]; // New structured system

  // New fields for UX enhancements
  timerStyle: 'countdown' | 'countup';  // Timer display mode
  showCurrentTime: boolean;              // Toggle for header time display
  muteSound: boolean;                    // Global mute toggle
  dailyNotesEnabled: boolean;            // Show/hide daily notes section
  customColors: string[];                // User-added hex colors
}

export interface DailyNote {
  date: string;        // YYYY-MM-DD format
  content: string;     // Free-form text (max 5000 chars)
  updatedAt: number;   // Timestamp
}

export interface TimeSlot {
  timestamp: number;
  timeLabel: string;
  log?: LogEntry;
  isCurrent: boolean;
  isPast: boolean;
}