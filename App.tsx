import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from './services/db';
import { LogEntry, AppSettings, TimeSlot, Category } from './types';
import { getDaySlots, getCurrentSlotTimestamp, formatTime, formatDateTitle, parseImportText, generateClipboardText, addDays, startOfDay, isSameDay, getTimeUntilNextSlot, getTimeInCurrentSlot, formatTimer, format } from './utils/timeUtils';
import { getCircadianColor, getContrastColor } from './utils/colorUtils';
import { TimeSlotItem } from './components/TimeSlotItem';
import { InputBar } from './components/InputBar';
import { StatsView } from './components/StatsView';
import { Settings, BarChart3, Bell, ChevronLeft, ChevronRight, PieChart, Download, Copy, Calendar, X, Volume2, VolumeX, Save, Upload, Trash2, Plus, ChevronDown, ChevronUp, RotateCw, FileText, AlertCircle } from 'lucide-react';
import { PRESET_CATEGORY_COLORS, RED_ALARM_GIF } from './constants';

const App: React.FC = () => {
  // --- State ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings>(db.getSettings());
  const [view, setView] = useState<'day' | 'stats' | 'settings'>('day');

  // Settings Accordion State
  const [openSettingSection, setOpenSettingSection] = useState<string>('time');

  // Category Management State
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#3B82F6");

  // Selection
  const [manualSelectedTimestamp, setManualSelectedTimestamp] = useState<number | null>(null);

  // Real-time
  const [realTimeSlot, setRealTimeSlot] = useState(getCurrentSlotTimestamp());

  // Alarm & Flash
  const [triggerFlash, setTriggerFlash] = useState(false);
  const [shakeScreen, setShakeScreen] = useState(false);
  const [alarmActive, setAlarmActive] = useState(false);
  const [showAlarmGif, setShowAlarmGif] = useState(false);

  // Calendar Activity Indicators
  const [activityDates, setActivityDates] = useState<number[]>([]);

  // Floating Controls & Timer
  const [showRefreshButton, setShowRefreshButton] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Daily Notes
  const [dailyNote, setDailyNote] = useState('');
  const [noteCharCount, setNoteCharCount] = useState(0);
  const [notesExpanded, setNotesExpanded] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Import Modal
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  // THEME STATE
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'circadian'>(() => {
    return (localStorage.getItem('flowstate_theme') as any) || 'light';
  });

  useEffect(() => {
    localStorage.setItem('flowstate_theme', themeMode);
  }, [themeMode]);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio(settings.soundId || '/alarm.mp3'));

  // Update audio source when settings change
  useEffect(() => {
    audioRef.current = new Audio(settings.soundId || '/alarm.mp3');
  }, [settings.soundId]);

  // --- Effects ---

  const refreshData = () => {
    setLogs(db.getLogs());
    setTags(db.getWeightedSuggestions());
    setSettings(db.getSettings());
    setActivityDates(db.getActivityDates());
  };

  useEffect(() => {
    refreshData();
    const timer = setInterval(() => {
      setRealTimeSlot(getCurrentSlotTimestamp());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Alarm Check
  useEffect(() => {
    if (!settings.notificationsEnabled) return;
    if (Notification.permission !== 'granted') Notification.requestPermission();

    const interval = setInterval(() => {
      const now = new Date();
      // Check exactly at :00, :15, :30, :45 minutes, 00 seconds
      if (now.getMinutes() % 15 === 0 && now.getSeconds() === 0) {
        setRealTimeSlot(getCurrentSlotTimestamp());

        // Mute check
        if (settings.muteUntil && now.getTime() < settings.muteUntil) return;
        if (settings.muteSound) return; // Global mute enabled

        // Check if previous slot is filled
        const ts = getCurrentSlotTimestamp();
        const prevTs = ts - (15 * 60 * 1000);
        const prevLog = logs.find(l => l.timestamp === prevTs);

        if (prevLog) return; // Already logged

        // Play Audio Once (only if not muted)
        try {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.log("Autoplay blocked", e));
        } catch (e) { console.error("Audio error", e) }

        // Visuals (7s Heartbeat)
        if (settings.visualFlashEnabled) {
          setTriggerFlash(true);
          setTimeout(() => setTriggerFlash(false), 7000); // 7 seconds exact
        }

        // Red Alarm GIF (5s)
        setShowAlarmGif(true);
        setTimeout(() => setShowAlarmGif(false), 5000);

        setAlarmActive(true);
        new Notification('FlowState: Log Check!', { body: 'Time to log!', icon: '/favicon.ico' });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [settings, logs]);

  // --- Computed ---

  const effectiveColors = useMemo(() => {
    const colors: Record<string, string> = { ...settings.categoryColors };
    settings.categories.forEach(cat => {
      colors[cat.name] = cat.color;
    });
    return colors;
  }, [settings]);

  const timeSlots = useMemo(() => {
    const rawSlots = getDaySlots(currentDate, settings.startHour, settings.endHour);
    return rawSlots.map((ts): TimeSlot => {
      const log = logs.find(l => l.timestamp === ts);
      return {
        timestamp: ts,
        timeLabel: formatTime(ts),
        log,
        isCurrent: ts === realTimeSlot,
        isPast: ts < realTimeSlot,
      };
    });
  }, [currentDate, settings, logs, realTimeSlot]);

  const activeTimestamp = manualSelectedTimestamp ?? realTimeSlot;
  const activeSlotLabel = formatTime(activeTimestamp);
  const activeSlotLog = logs.find(l => l.timestamp === activeTimestamp);

  // --- Handlers ---

  const handleLogSubmit = (text: string, category?: string) => {
    // Check for Bulk (Multiline)
    if (text.includes('\n')) {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      let currentTs = activeTimestamp;

      lines.forEach(line => {
        const newEntry: LogEntry = {
          id: crypto.randomUUID(),
          timestamp: currentTs,
          description: line,
          category: category // Apply same category to all? Or try to auto-detect? User didn't specify. Assuming same or text.
        };
        db.saveLog(newEntry);
        // Increment 15m
        currentTs += 15 * 60 * 1000;
        // Flash last item in bulk?
        if (lines.indexOf(line) === lines.length - 1) {
          setJustSavedId(newEntry.id);
          setTimeout(() => setJustSavedId(null), 2000);
        }
      });
      refreshData();
      setManualSelectedTimestamp(currentTs); // Advance to after the last bulk item
      return;
    }

    const finalCategory = category || text;
    const newEntry: LogEntry = {
      id: activeSlotLog ? activeSlotLog.id : crypto.randomUUID(),
      timestamp: activeTimestamp,
      description: text,
      category: finalCategory
    };

    db.saveLog(newEntry);
    if (finalCategory) db.addTag(finalCategory);
    db.updateLastActivity(); // Track activity for refresh button
    setShowRefreshButton(false);

    setJustSavedId(newEntry.id);
    setTimeout(() => setJustSavedId(null), 2000);

    refreshData();
    // Auto-Advance: Move to next 15m slot instead of closing
    setManualSelectedTimestamp(activeTimestamp + (15 * 60 * 1000));
    setAlarmActive(false);
    setTriggerFlash(false);
  };

  const handleLogDelete = () => {
    if (activeSlotLog) {
      db.deleteLog(activeSlotLog.id);
      refreshData();
      setManualSelectedTimestamp(null);
    }
  };

  // New Clear Slot Handler
  const handleClearSlot = (slot: TimeSlot) => {
    if (slot.log) {
      db.deleteLog(slot.log.id);
      refreshData();
    }
  };

  const handleImportText = () => {
    const parsed = parseImportText(importText, currentDate);
    parsed.forEach(p => {
      const entry: LogEntry = { id: crypto.randomUUID(), timestamp: p.timestamp, description: p.description, category: p.category };
      db.saveLog(entry);
    });

    setImportText("");
    setShowImport(false);
    refreshData();
  };

  const handleCopyDay = () => {
    const text = generateClipboardText(logs, currentDate);
    navigator.clipboard.writeText(text).then(() => {
      alert("Day logs copied to clipboard!");
    });
  };

  const updateSetting = (key: keyof AppSettings, val: any) => {
    const newSettings = { ...settings, [key]: val };
    setSettings(newSettings);
    db.saveSettings(newSettings);
  };

  const SettingsHeader = ({ id, title, icon: Icon }: any) => (
    <button
      onClick={() => setOpenSettingSection(openSettingSection === id ? '' : id)}
      className="w-full flex items-center justify-between p-4 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
    >
      <div className="flex items-center gap-3 font-semibold text-gray-800">
        <Icon size={20} className="text-indigo-600" />
        {title}
      </div>
      {openSettingSection === id ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
    </button>
  );

  const IOSToggle = ({ checked, onChange, disabled }: { checked: boolean, onChange: (val: boolean) => void, disabled?: boolean }) => (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
        checked ? 'bg-indigo-600' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
        checked ? 'translate-x-7' : 'translate-x-1'
      }`} />
    </button>
  );

  // --- Theme Logic ---
  const currentHour = new Date().getHours();

  let themeStyles = {};
  let themeClass = "";

  if (themeMode === 'dark') {
    const bgColor = '#22223B';
    const textColor = getContrastColor(bgColor);
    themeClass = "transition-colors duration-[120000ms]"; // 2-minute smooth transition
    themeStyles = { backgroundColor: bgColor, color: textColor };
  } else if (themeMode === 'circadian') {
    const bgColor = getCircadianColor(currentHour);
    const textColor = getContrastColor(bgColor);
    themeClass = "transition-colors duration-[120000ms]"; // 2-minute smooth transition
    themeStyles = { backgroundColor: bgColor, color: textColor };
  } else {
    themeClass = "bg-gray-50 text-gray-900";
  }

  // Update circadian colors every 30 seconds
  useEffect(() => {
    if (themeMode !== 'circadian') return;

    const interval = setInterval(() => {
      setRealTimeSlot(getCurrentSlotTimestamp()); // Force re-render
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [themeMode]);

  // Timer update (every second)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      if (settings.timerStyle === 'countdown') {
        setTimerSeconds(getTimeUntilNextSlot());
      } else {
        setTimerSeconds(getTimeInCurrentSlot());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [settings.timerStyle]);

  // Check for inactivity (every minute)
  useEffect(() => {
    const interval = setInterval(() => {
      setShowRefreshButton(db.shouldShowRefreshButton());
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Load daily note on date change
  useEffect(() => {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const note = db.getDailyNote(dateStr);
    setDailyNote(note?.content || '');
    setNoteCharCount(note?.content?.length || 0);
  }, [currentDate]);

  // Auto-save daily note with debounce
  const handleNoteChange = (content: string) => {
    if (content.length > 5000) return;

    setDailyNote(content);
    setNoteCharCount(content.length);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      if (content.trim()) {
        db.saveDailyNote({
          date: dateStr,
          content,
          updatedAt: Date.now()
        });
      } else {
        // Delete empty notes
        db.deleteDailyNote(dateStr);
      }
    }, 300);
  };

  return (
    <div
      className={`flex flex-col h-screen font-sans overflow-hidden ${themeClass} ${shakeScreen ? 'animate-shake' : ''}`}
      style={themeStyles}
    >

      {/* Heartbeat Flash Overlay */}
      {triggerFlash && (
        <div className="fixed inset-0 z-50 pointer-events-none bg-green-500/20 animate-pulse mix-blend-overlay"></div>
      )}

      {/* Red Alarm GIF Overlay */}
      {showAlarmGif && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] cursor-pointer animate-in fade-in zoom-in duration-300"
          onClick={() => setShowAlarmGif(false)}
        >
          <div className="relative bg-black/30 rounded-2xl p-4 backdrop-blur-sm shadow-2xl">
            <img src={RED_ALARM_GIF} alt="Alarm" className="w-32 h-32 rounded-lg" />
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`border-b px-4 py-3 sticky top-0 z-10 flex justify-between items-center shadow-sm transition-colors duration-[120000ms]
          ${themeMode === 'dark' ? 'bg-slate-800 border-slate-700 text-white' :
          themeMode === 'circadian' ? 'bg-white/10 backdrop-blur-md border-white/20 text-inherit' :
            'bg-white border-gray-200 text-gray-900'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shadow-md transition-colors ${alarmActive ? 'bg-red-600 animate-pulse' : 'bg-indigo-600'}`}>F</div>
          <h1 className="font-bold text-lg tracking-tight hidden sm:block">FlowState</h1>
        </div>

        {/* Timer Display (centered) */}
        {settings.showCurrentTime && (
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <div className="text-sm font-mono font-semibold">
              {format(currentTime, 'HH:mm')}
            </div>
            <div className="text-xs font-mono font-semibold">
              {settings.timerStyle === 'countdown' ? '−' : '+'}{formatTimer(timerSeconds)}
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setView('day')} className={`p-2 rounded-lg transition-all ${view === 'day' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'}`}><BarChart3 size={20} className="rotate-90" /></button>
          <button onClick={() => setView('stats')} className={`p-2 rounded-lg transition-all ${view === 'stats' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'}`}><PieChart size={20} /></button>
          <button onClick={() => setView('settings')} className={`p-2 rounded-lg transition-all ${view === 'settings' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'}`}><Settings size={20} /></button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-32 relative" ref={scrollRef}>
        {view === 'day' && (
          <>
            <div className="max-w-md mx-auto px-4 pt-4 pb-2 space-y-2">
              <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                <button onClick={() => setCurrentDate(addDays(currentDate, -1))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronLeft size={20} /></button>
                <div className="font-semibold text-gray-800">{formatDateTitle(currentDate)}</div>
                <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronRight size={20} /></button>
              </div>
              <div className="flex justify-end gap-2 px-1">
                <button onClick={handleCopyDay} className="text-xs text-gray-500 hover:text-indigo-600 font-medium px-2 py-1 bg-white border rounded flex items-center gap-1"><Copy size={12} /> Copy</button>
                <button onClick={() => setShowImport(true)} className="text-xs text-gray-500 hover:text-indigo-600 font-medium px-2 py-1 bg-white border rounded flex items-center gap-1"><Upload size={12} /> Import</button>
              </div>
            </div>
            <div className="max-w-md mx-auto p-4 pt-2 space-y-1">
              {timeSlots.map(slot => (
                <div
                  key={slot.timestamp}
                  data-current={slot.isCurrent}
                  className={manualSelectedTimestamp === slot.timestamp ? "ring-2 ring-indigo-400 rounded-xl" : ""}
                >
                  <TimeSlotItem
                    slot={slot}
                    onClick={(s) => setManualSelectedTimestamp(s.timestamp)}
                    onClear={handleClearSlot}
                    isAlarmActive={alarmActive}
                    categoryColors={effectiveColors}
                    isJustSaved={justSavedId === slot.log?.id}
                  />
                </div>
              ))}
              <div className="h-12"></div>
            </div>

            {/* Daily Notes Section */}
            {settings.dailyNotesEnabled && (
              <div className="max-w-md mx-auto px-4 pb-4 mt-2">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setNotesExpanded(!notesExpanded)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={20} className="text-indigo-600" />
                      <span className="font-semibold text-gray-800">Daily Notes</span>
                      {noteCharCount > 0 && (
                        <span className="text-xs text-gray-500">({noteCharCount} chars)</span>
                      )}
                    </div>
                    {notesExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                  </button>

                  {notesExpanded && (
                    <div className="p-4 pt-0 animate-in slide-in-from-top-2 duration-200">
                      <textarea
                        value={dailyNote}
                        onChange={(e) => handleNoteChange(e.target.value)}
                        placeholder="Jot down thoughts about today..."
                        className="w-full min-h-[120px] p-3 bg-gray-50 border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-800"
                        maxLength={5000}
                      />
                      {noteCharCount >= 4500 && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 mt-2">
                          <AlertCircle size={14} />
                          <span>{noteCharCount} / 5,000 characters</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {view === 'stats' && <StatsView logs={logs} currentDate={currentDate} categoryColors={effectiveColors} categories={settings.categories} />}

        {view === 'settings' && (
          <div className="max-w-md mx-auto p-4 space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

              {/* Time Settings */}
              <SettingsHeader id="time" title="Time Settings" icon={Settings} />
              {openSettingSection === 'time' && (
                <div className="p-4 bg-gray-50 border-b border-gray-100 animate-in slide-in-from-top-2">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-500">Start Hour</label>
                      <input type="number" value={settings.startHour} onChange={e => updateSetting('startHour', +e.target.value)} className="w-full p-2 rounded border mt-1" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-500">End Hour</label>
                      <input type="number" value={settings.endHour} onChange={e => updateSetting('endHour', +e.target.value)} className="w-full p-2 rounded border mt-1" />
                    </div>
                  </div>
                </div>
              )}

              {/* Appearance */}
              <SettingsHeader id="appearance" title="Appearance" icon={PieChart} />
              {openSettingSection === 'appearance' && (
                <div className="p-4 bg-gray-50 border-b border-gray-100 animate-in slide-in-from-top-2 space-y-4">

                  {/* Theme Selector */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-2">Theme</label>
                    <div className="bg-white border rounded-xl overflow-hidden flex divide-x divide-gray-100">
                      {(['light', 'dark', 'circadian'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setThemeMode(mode)}
                          className={`flex-1 py-2 text-sm font-medium capitalize transition-colors
                               ${themeMode === mode ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-600'}
                            `}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Show Current Time Toggle */}
                  <div className="flex justify-between items-center min-h-[44px]">
                    <span className="font-medium text-gray-700">Show Current Time</span>
                    <IOSToggle checked={settings.showCurrentTime} onChange={(val) => updateSetting('showCurrentTime', val)} />
                  </div>

                  {/* Timer Style */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-2">Timer Style</label>
                    <div className="bg-white border rounded-xl overflow-hidden flex divide-x divide-gray-100">
                      {(['countdown', 'countup'] as const).map(style => (
                        <button
                          key={style}
                          onClick={() => updateSetting('timerStyle', style)}
                          className={`flex-1 py-2 text-sm font-medium capitalize transition-colors
                               ${settings.timerStyle === style ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-600'}
                            `}
                        >
                          {style === 'countdown' ? 'Countdown' : 'Count Up'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Categories */}
              <SettingsHeader id="categories" title="Manage Categories" icon={PieChart} />
              {openSettingSection === 'categories' && (
                <div className="p-4 bg-gray-50 border-b border-gray-100 animate-in slide-in-from-top-2">
                  {/* Color Palette */}
                  <div className="mb-6">
                    <label className="text-xs font-semibold text-gray-500 block mb-3 uppercase tracking-wide">Color Palette</label>
                    <div className="grid grid-cols-7 gap-2">
                      {PRESET_CATEGORY_COLORS.map(color => (
                        <button
                          key={color}
                          className="w-12 h-12 rounded-lg border-2 border-gray-200 hover:border-indigo-500 hover:scale-110 transition-all"
                          style={{backgroundColor: color}}
                          aria-label={`Preset color ${color}`}
                        />
                      ))}
                      {(settings.customColors || []).map(color => (
                        <div key={color} className="relative group">
                          <div className="w-12 h-12 rounded-lg border-2 border-gray-200" style={{backgroundColor: color}} />
                          <button
                            onClick={() => {
                              if (confirm('Remove this custom color? Existing categories will keep this color.')) {
                                updateSetting('customColors', (settings.customColors || []).filter(c => c !== color));
                              }
                            }}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <label className="w-12 h-12 rounded-lg border-2 border-dashed border-gray-300 hover:border-indigo-500 hover:scale-110 flex items-center justify-center cursor-pointer transition-all">
                        <Plus size={20} className="text-gray-400" />
                        <input
                          type="color"
                          className="hidden"
                          onChange={(e) => {
                            const newColor = e.target.value;
                            const currentCustom = settings.customColors || [];
                            if (currentCustom.length >= 10) {
                              alert('Maximum 10 custom colors allowed');
                              return;
                            }
                            if (!currentCustom.includes(newColor)) {
                              updateSetting('customColors', [...currentCustom, newColor]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Category List */}
                  <label className="text-xs font-semibold text-gray-500 block mb-3 uppercase tracking-wide">Categories</label>
                  <div className="space-y-2 mb-4">
                    {settings.categories.map(cat => (
                      <div key={cat.id} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-100">
                        <input type="color" value={cat.color} onChange={(e) => {
                          const updated = settings.categories.map(c => c.id === cat.id ? { ...c, color: e.target.value } : c);
                          updateSetting('categories', updated);
                        }} className="w-8 h-8 rounded cursor-pointer border-none p-0" />
                        <input
                          type="text"
                          value={cat.name}
                          onChange={(e) => {
                            const updated = settings.categories.map(c => c.id === cat.id ? { ...c, name: e.target.value } : c);
                            updateSetting('categories', updated);
                          }}
                          className="flex-1 text-sm p-1 border-b border-transparent focus:border-indigo-300 outline-none"
                        />
                        <button onClick={() => {
                          if (confirm("Delete?")) {
                            const updated = settings.categories.filter(c => c.id !== cat.id);
                            updateSetting('categories', updated);
                          }
                        }} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" placeholder="New Category" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="flex-1 p-2 text-sm rounded border" />
                    <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="w-10 h-9 p-0 rounded cursor-pointer" />
                    <button onClick={() => {
                      if (!newCatName.trim()) return;
                      const newCat: Category = { id: crypto.randomUUID(), name: newCatName.trim(), color: newCatColor };
                      updateSetting('categories', [...settings.categories, newCat]);
                      setNewCatName("");
                    }} className="p-2 bg-indigo-600 text-white rounded"><Plus size={20} /></button>
                  </div>
                </div>
              )}

              {/* Notifications */}
              <SettingsHeader id="notifications" title="Notifications & Alerts" icon={Bell} />
              {openSettingSection === 'notifications' && (
                <div className="p-4 bg-gray-50 border-b border-gray-100 animate-in slide-in-from-top-2 space-y-4">
                  <div className="flex justify-between items-center min-h-[44px]">
                    <span className="font-medium text-gray-700">Enable Sound</span>
                    <IOSToggle checked={settings.notificationsEnabled} onChange={(val) => updateSetting('notificationsEnabled', val)} />
                  </div>
                  <div className="flex justify-between items-center min-h-[44px]">
                    <span className="font-medium text-gray-700">Mute Sound</span>
                    <IOSToggle checked={settings.muteSound} onChange={(val) => updateSetting('muteSound', val)} />
                  </div>
                  <div className="flex justify-between items-center min-h-[44px]">
                    <span className="font-medium text-gray-700">Visual Flash</span>
                    <IOSToggle checked={settings.visualFlashEnabled} onChange={(val) => updateSetting('visualFlashEnabled', val)} />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-2">Notification Sound</label>
                    <div className="bg-white border rounded-xl overflow-hidden flex divide-x divide-gray-100">
                      {['/alarm.mp3', '/chime.mp3', '/bell.mp3'].map((sound, idx) => {
                        const label = idx === 0 ? 'Alarm' : idx === 1 ? 'Chime' : 'Bell';
                        const isActive = settings.soundId === sound;
                        return (
                          <button
                            key={sound}
                            onClick={() => {
                              updateSetting('soundId', sound);
                              const audio = new Audio(sound);
                              audio.play().catch(() => { });
                            }}
                            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2
                               ${isActive ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-600'}
                             `}
                          >
                            {isActive && <Volume2 size={14} className="animate-pulse" />}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button onClick={() => {
                    audioRef.current.play();
                    setTriggerFlash(true);
                    setShowAlarmGif(true);
                    setTimeout(() => setTriggerFlash(false), 7000);
                    setTimeout(() => setShowAlarmGif(false), 5000);
                  }} className="w-full py-3 bg-indigo-100 text-indigo-700 rounded-lg font-medium text-sm hover:bg-indigo-200 transition-colors">Test Alarm (7s)</button>
                </div>
              )}

              {/* Daily Notes */}
              <SettingsHeader id="dailynotes" title="Daily Notes" icon={FileText} />
              {openSettingSection === 'dailynotes' && (
                <div className="p-4 bg-gray-50 border-b border-gray-100 animate-in slide-in-from-top-2">
                  <div className="flex justify-between items-center min-h-[44px]">
                    <div>
                      <span className="font-medium text-gray-700">Enable Daily Notes</span>
                      <p className="text-xs text-gray-500 mt-1">Show notes section at bottom of day view</p>
                    </div>
                    <IOSToggle checked={settings.dailyNotesEnabled} onChange={(val) => updateSetting('dailyNotesEnabled', val)} />
                  </div>
                </div>
              )}

              {/* Data */}
              <SettingsHeader id="data" title="Data & Storage" icon={Save} />
              {openSettingSection === 'data' && (
                <div className="p-4 bg-gray-50 animate-in slide-in-from-top-2 space-y-3">
                  <button onClick={() => {
                    const blob = new Blob([db.exportData()], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'flowstate_backup.json';
                    a.click();
                  }} className="w-full flex items-center justify-center gap-2 p-2 bg-white border rounded hover:bg-gray-50"><Download size={16} /> Download Backup</button>

                  <div className="relative">
                    <input type="file" accept=".json" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const r = new FileReader();
                        r.onload = ev => {
                          if (db.restoreData(ev.target?.result as string)) window.location.reload();
                        };
                        r.readAsText(f);
                      }
                    }} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <button className="w-full flex items-center justify-center gap-2 p-2 bg-white border rounded hover:bg-gray-50"><Upload size={16} /> Restore Backup</button>
                  </div>

                  {/* Danger Zone */}
                  <div className="pt-4 border-t border-red-100 mt-4">
                    <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2">Danger Zone</h4>
                    <button
                      onClick={() => {
                        if (confirm("ARE YOU SURE? This will wipe all your data permanently. This cannot be undone.")) {
                          if (confirm("Really? Last chance.")) {
                            localStorage.clear();
                            window.location.reload();
                          }
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={16} /> Factory Reset / Clear Data
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </main>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Import Logs</h3>
            <textarea value={importText} onChange={e => setImportText(e.target.value)} className="w-full h-40 bg-gray-50 p-3 rounded-lg text-sm border font-mono" placeholder="09:00 Task..."></textarea>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowImport(false)} className="flex-1 py-3 text-gray-500 font-bold">Cancel</button>
              <button onClick={handleImportText} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Control Buttons */}
      {view === 'day' && (
        <>
          {/* Refresh Button - Left */}
          {showRefreshButton && (
            <button
              onClick={() => {
                const currentSlot = document.querySelector('[data-current="true"]');
                currentSlot?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setManualSelectedTimestamp(null); // Focus current slot
                setShowRefreshButton(false);
              }}
              className="fixed bottom-24 left-4 z-40 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 hover:scale-110 transition-all flex items-center justify-center"
              aria-label="Scroll to current time slot"
            >
              <RotateCw size={24} />
            </button>
          )}

          {/* Mute Button - Right */}
          <button
            onClick={() => {
              updateSetting('muteSound', !settings.muteSound);
            }}
            className="fixed bottom-24 right-4 z-40 w-14 h-14 bg-white border-2 border-gray-200 rounded-full shadow-lg hover:border-indigo-500 hover:scale-110 transition-all flex items-center justify-center"
            aria-label={settings.muteSound ? 'Unmute' : 'Mute'}
          >
            {settings.muteSound ? (
              <VolumeX size={24} className="text-gray-400" />
            ) : (
              <Volume2 size={24} className="text-indigo-600" />
            )}
          </button>
        </>
      )}

      {/* Input */}
      {view === 'day' && (
        <InputBar
          onSubmit={handleLogSubmit}
          onDelete={activeSlotLog ? handleLogDelete : undefined}
          recentTags={tags}
          recentDescriptions={db.getAutocompleteCache()}
          currentSlotLabel={activeSlotLabel}
          isFocusedSlotFilled={!!activeSlotLog}
          initialText={activeSlotLog?.description ?? ''}
          shouldFocus={alarmActive}
          categories={settings.categories}
          categoryColors={settings.categoryColors}
          onUpdateCategoryColor={(cat, col) => updateSetting('categoryColors', { ...settings.categoryColors, [cat]: col })}
          onAutoTag={(text) => db.findLastCategoryForText(text)}
          themeMode={themeMode}
        />
      )}
    </div>
  );
};

export default App;
