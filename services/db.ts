import { LogEntry, AppSettings, Category } from '../types';
import { STORAGE_KEYS, DEFAULT_SETTINGS as CONST_DEFAULT } from '../constants';
import { startOfDay } from '../utils/timeUtils';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'work', name: 'Work', color: '#3B82F6' },       // Blue
  { id: 'deep-work', name: 'Deep Work', color: '#8B5CF6' }, // Purple
  { id: 'meetings', name: 'Meetings', color: '#EF4444' },   // Red
  { id: 'errands', name: 'Errands', color: '#10B981' },     // Green
  { id: 'misc', name: 'Misc', color: '#6B7280' },           // Gray
];

const getLocalStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading ${key}`, error);
    return defaultValue;
  }
};

const setLocalStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key}`, error);
  }
};

export const db = {
  getLogs: (): LogEntry[] => {
    return getLocalStorage<LogEntry[]>(STORAGE_KEYS.LOGS, []);
  },

  saveLog: (entry: LogEntry): LogEntry[] => {
    const logs = db.getLogs();
    const existingIndex = logs.findIndex((l) => l.timestamp === entry.timestamp);

    let newLogs;
    if (existingIndex >= 0) {
      newLogs = [...logs];
      newLogs[existingIndex] = entry;
    } else {
      newLogs = [...logs, entry];
    }

    newLogs.sort((a, b) => a.timestamp - b.timestamp);
    setLocalStorage(STORAGE_KEYS.LOGS, newLogs);
    return newLogs;
  },

  deleteLog: (id: string): LogEntry[] => {
    const logs = db.getLogs().filter((l) => l.id !== id);
    setLocalStorage(STORAGE_KEYS.LOGS, logs);
    return logs;
  },

  getTags: (): string[] => {
    return getLocalStorage<string[]>(STORAGE_KEYS.TAGS, []);
  },

  addTag: (description: string): void => {
    if (!description) return;
    const tags = new Set(db.getTags());
    tags.add(description);
    const sortedTags = Array.from(tags).slice(-100);
    setLocalStorage(STORAGE_KEYS.TAGS, sortedTags);
  },

  getWeightedSuggestions: (limit: number = 8): string[] => {
    const logs = db.getLogs();
    const now = Date.now();
    const scores: Record<string, number> = {};

    // 1. Calculate scores
    logs.forEach(log => {
      if (!log.description) return;
      const desc = log.description.trim();
      if (!desc) return;

      const ageHours = (now - log.timestamp) / (1000 * 60 * 60);
      let multiplier = 1.0;

      if (ageHours <= 48) {
        multiplier = 1.0;
      } else if (ageHours <= 72) { // Day 3
        multiplier = 0.8;
      } else if (ageHours <= 168) { // Day 7
        multiplier = 0.2;
      } else if (ageHours <= 336) { // Day 14+
        multiplier = 0.1;
      } else if (ageHours > 4320) { // 6 Months
        multiplier = 0.0;
      } else {
        multiplier = 0.1;
      }

      scores[desc] = (scores[desc] || 0) + (1 * multiplier);
    });

    // 2. Sort by score
    return Object.entries(scores)
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
      .map(([desc]) => desc)
      .slice(0, limit);
  },

  getSettings: (): AppSettings => {
    const saved = getLocalStorage<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {});

    // Merge with defaults
    return {
      startHour: saved.startHour ?? CONST_DEFAULT.startHour,
      endHour: saved.endHour ?? CONST_DEFAULT.endHour,
      notificationsEnabled: saved.notificationsEnabled ?? CONST_DEFAULT.notificationsEnabled,
      visualFlashEnabled: saved.visualFlashEnabled ?? CONST_DEFAULT.visualFlashEnabled,
      soundId: saved.soundId ?? CONST_DEFAULT.soundId,
      muteUntil: saved.muteUntil,
      categoryColors: saved.categoryColors ?? {},
      categories: saved.categories && saved.categories.length > 0 ? saved.categories : DEFAULT_CATEGORIES
    };
  },

  saveSettings: (settings: AppSettings): void => {
    setLocalStorage(STORAGE_KEYS.SETTINGS, settings);
  },

  getActivityDates: (): number[] => {
    const logs = db.getLogs();
    const days = new Set<number>();
    logs.forEach(l => {
      days.add(startOfDay(new Date(l.timestamp)).getTime());
    });
    return Array.from(days);
  },

  // --- Backup & Restore ---
  exportData: (): string => {
    const data = {
      logs: db.getLogs(),
      settings: db.getSettings(),
      tags: db.getTags()
    };
    return JSON.stringify(data, null, 2);
  },

  restoreData: (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      if (!data.logs) throw new Error("Invalid backup format");

      setLocalStorage(STORAGE_KEYS.LOGS, data.logs);
      if (data.settings) setLocalStorage(STORAGE_KEYS.SETTINGS, data.settings);
      if (data.tags) setLocalStorage(STORAGE_KEYS.TAGS, data.tags);

      return true;
    } catch (e) {
      console.error("Restore failed", e);
      return false;
    }
  },

  // --- Smart Logic ---
  findLastCategoryForText: (text: string): string | undefined => {
    if (!text || !text.trim()) return undefined;
    const cleanText = text.trim().toLowerCase();

    // Get logs, reverse to find most recent first
    const logs = [...db.getLogs()].reverse();
    const now = new Date().getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    for (const log of logs) {
      // Limit to 30 days history for relevance
      if (now - log.timestamp > thirtyDays) break;

      if (log.description && log.description.toLowerCase() === cleanText && log.category) {
        return log.category;
      }
    }
    return undefined;
  }
};
