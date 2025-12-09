import { LogEntry, AppSettings } from '../types';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../constants';
import { startOfDay } from '../utils/timeUtils';

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
    db.addTag(entry.description);
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
    // Extract hashtag if present to store as well
    const tagMatch = description.match(/#(\w+)/);
    const tags = new Set(db.getTags());
    
    if (tagMatch) {
       tags.add(`#${tagMatch[1]}`);
    } else {
       // Also store full descriptions as "recent" for autocomplete
       // Clean up descriptions that are just too long
       if(description.length < 30) tags.add(description);
    }

    const sortedTags = Array.from(tags).slice(-100); 
    setLocalStorage(STORAGE_KEYS.TAGS, sortedTags);
  },

  getSettings: (): AppSettings => {
    const saved = getLocalStorage<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {});
    return {
      ...DEFAULT_SETTINGS,
      visualFlashEnabled: true, // Default to true for the feature
      ...saved
    };
  },

  saveSettings: (settings: AppSettings): void => {
    setLocalStorage(STORAGE_KEYS.SETTINGS, settings);
  },

  // Efficiently get a list of timestamps (start of day) that have logs
  getActivityDates: (): number[] => {
    const logs = db.getLogs();
    const days = new Set<number>();
    logs.forEach(l => {
      days.add(startOfDay(new Date(l.timestamp)).getTime());
    });
    return Array.from(days);
  }
};
