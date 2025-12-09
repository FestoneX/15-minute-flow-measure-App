// Native Date implementations to replace date-fns
export const startOfDay = (date: Date | number): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const endOfDay = (date: Date | number): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const setHours = (date: Date | number, hours: number): Date => {
  const d = new Date(date);
  d.setHours(hours);
  return d;
};

export const setMinutes = (date: Date | number, minutes: number): Date => {
  const d = new Date(date);
  d.setMinutes(minutes);
  return d;
};

export const addMinutes = (date: Date | number, amount: number): Date => {
  return new Date(new Date(date).getTime() + amount * 60000);
};

export const addDays = (date: Date | number, amount: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
};

export const isSameDay = (dateLeft: Date | number, dateRight: Date | number): boolean => {
  const d1 = startOfDay(dateLeft);
  const d2 = startOfDay(dateRight);
  return d1.getTime() === d2.getTime();
};

export const startOfWeek = (date: Date | number, options: { weekStartsOn?: number } = {}): Date => {
  const d = startOfDay(date);
  const day = d.getDay();
  const weekStartsOn = options.weekStartsOn || 0;
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  return d;
};

export const endOfWeek = (date: Date | number, options: { weekStartsOn?: number } = {}): Date => {
  const d = startOfWeek(date, options);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const isWithinInterval = (date: Date | number, interval: { start: Date | number; end: Date | number }): boolean => {
  const time = new Date(date).getTime();
  const startTime = new Date(interval.start).getTime();
  const endTime = new Date(interval.end).getTime();
  return time >= startTime && time <= endTime;
};

export const format = (date: Date | number, formatStr: string): string => {
  const d = new Date(date);
  if (formatStr === 'HH:mm') {
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  if (formatStr === 'EEE, MMM d') {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    // To match "EEE, MMM d" (e.g., "Fri, Oct 25")
    // toLocaleDateString might return "Fri, Oct 25" depending on locale, let's enforce simplified US for consistency
    const parts = d.toLocaleDateString('en-US', options).replace(/(\w+), (\w+) (\d+)/, '$1, $2 $3');
    // Manual fallback to ensure format
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  }
  return d.toDateString();
};

export const getDaySlots = (date: Date, startHour: number, endHour: number): number[] => {
  const dayStart = startOfDay(date);
  let startTime = setHours(dayStart, startHour);

  // Calculate total duration
  let durationHours = endHour - startHour;
  if (durationHours <= 0) {
    // Overnight shift (e.g., 22:00 to 04:00 is 6 hours)
    durationHours += 24;
  }

  const totalSlots = durationHours * 4; // 4 slots per hour

  const timestamps: number[] = [];
  for (let i = 0; i < totalSlots; i++) {
    timestamps.push(addMinutes(startTime, i * 15).getTime());
  }
  return timestamps;
};

export const formatTime = (timestamp: number): string => {
  return format(new Date(timestamp), 'HH:mm');
};

export const formatDateTitle = (date: Date): string => {
  if (isSameDay(date, new Date())) return 'Today';
  return format(date, 'EEE, MMM d');
};

export const getCurrentSlotTimestamp = (): number => {
  const now = new Date();
  const minutes = now.getMinutes();
  const remainder = minutes % 15;
  const roundedNow = new Date(now);
  roundedNow.setMinutes(minutes - remainder);
  roundedNow.setSeconds(0);
  roundedNow.setMilliseconds(0);
  return roundedNow.getTime();
};

export const isSameDate = (ts1: number, date2: Date): boolean => {
  return isSameDay(new Date(ts1), date2);
};

export const getDateRange = (date: Date, type: 'day' | 'week'): { start: Date, end: Date } => {
  if (type === 'day') {
    return { start: startOfDay(date), end: addDays(startOfDay(date), 1) };
  } else {
    return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
  }
};

// --- Parsers & Exporters ---

export const parseImportText = (text: string, baseDate: Date): Array<{ timestamp: number, description: string, category?: string }> => {
  const lines = text.split('\n');
  const results = [];
  const baseDayStart = startOfDay(baseDate);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match "HH:mm Description #tag"
    // Regex: ^(\d{1,2}:\d{2})\s+(.+)$
    const match = trimmed.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
    if (match) {
      const timeStr = match[1];
      const content = match[2];

      const [hours, minutes] = timeStr.split(':').map(Number);
      const slotTime = setHours(setMinutes(baseDayStart, minutes), hours);

      // Handle overnight inference (simple heuristic: if parsing for "today", assume entered time is mostly correct relative to baseDate)
      // Note: This simple parser assumes the time is on the baseDate. 

      // Extract Category
      const tagMatch = content.match(/#(\w+)/);
      const category = tagMatch ? tagMatch[1] : undefined;

      results.push({
        timestamp: slotTime.getTime(),
        description: content,
        category
      });
    }
  }
  return results;
};

export const generateClipboardText = (logs: { timestamp: number, description: string }[], date: Date): string => {
  const dayStart = startOfDay(date).getTime();
  const dayEnd = endOfDay(date).getTime();

  const dayLogs = logs.filter(l => l.timestamp >= dayStart && l.timestamp <= dayEnd);

  if (!dayLogs.length) return "No logs for this day.";

  return dayLogs.sort((a, b) => a.timestamp - b.timestamp).map(l => {
    return `${formatTime(l.timestamp)} ${l.description}`;
  }).join('\n');
};
