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
}

export interface TimeSlot {
  timestamp: number;
  timeLabel: string;
  log?: LogEntry;
  isCurrent: boolean;
  isPast: boolean;
}