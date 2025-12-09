import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from './services/db';
import { LogEntry, AppSettings, TimeSlot, Category } from './types';
import { getDaySlots, getCurrentSlotTimestamp, formatTime, formatDateTitle, parseImportText, generateClipboardText, addDays, startOfDay, isSameDay } from './utils/timeUtils';
import { TimeSlotItem } from './components/TimeSlotItem';
import { InputBar } from './components/InputBar';
import { StatsView } from './components/StatsView';
import { Settings, BarChart3, Bell, ChevronLeft, ChevronRight, PieChart, Download, Copy, Calendar, X, Volume2, Save, Upload, Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings>(db.getSettings());
  const [view, setView] = useState<'day' | 'stats' | 'settings'>('day');

  // Settings Accordion State
  const [openSettingSection, setOpenSettingSection] = useState<string>('general');

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

  // Calendar Activity Indicators
  const [activityDates, setActivityDates] = useState<number[]>([]);

  // Import Modal
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio('/alarm.mp3'));

  // --- Effects ---

  const refreshData = () => {
    setLogs(db.getLogs());
    setTags(db.getTags());
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

        // Check if previous slot is filled
        const ts = getCurrentSlotTimestamp();
        const prevTs = ts - (15 * 60 * 1000);
        const prevLog = logs.find(l => l.timestamp === prevTs);

        if (prevLog) return; // Already logged

        // Play Audio Once
        try {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.log("Autoplay blocked", e));
        } catch (e) { console.error("Audio error", e) }

        // Visuals (7s Heartbeat)
        if (settings.visualFlashEnabled) {
          setTriggerFlash(true);
          setTimeout(() => setTriggerFlash(false), 7000); // 7 seconds exact
        }

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
    const finalCategory = category || text;
    const newEntry: LogEntry = {
      id: activeSlotLog ? activeSlotLog.id : crypto.randomUUID(),
      timestamp: activeTimestamp,
      description: text,
      category: finalCategory
    };

    db.saveLog(newEntry);
    if (finalCategory) db.addTag(finalCategory);

    refreshData();
    setManualSelectedTimestamp(null);
    setAlarmActive(false);
    setTriggerFlash(false); // Stop flash on interaction
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

  return (
    <div className={`flex flex-col h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden ${shakeScreen ? 'animate-shake' : ''}`}>

      {/* Heartbeat Flash Overlay */}
      {triggerFlash && (
        <div className="fixed inset-0 z-50 pointer-events-none bg-red-500 animate-heartbeat mix-blend-overlay"></div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shadow-md transition-colors ${alarmActive ? 'bg-red-600 animate-pulse' : 'bg-indigo-600'}`}>F</div>
          <h1 className="font-bold text-lg tracking-tight hidden sm:block">FlowState</h1>
        </div>

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
                <div key={slot.timestamp} className={manualSelectedTimestamp === slot.timestamp ? "ring-2 ring-indigo-400 rounded-xl" : ""}>
                  <TimeSlotItem
                    slot={slot}
                    onClick={(s) => setManualSelectedTimestamp(s.timestamp)}
                    onClear={handleClearSlot}
                    isAlarmActive={alarmActive}
                    categoryColors={effectiveColors}
                  />
                </div>
              ))}
              <div className="h-12"></div>
            </div>
          </>
        )}

        {view === 'stats' && <StatsView logs={logs} currentDate={currentDate} categoryColors={effectiveColors} categories={settings.categories} />}

        {view === 'settings' && (
          <div className="max-w-md mx-auto p-4 space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

              {/* General Settings */}
              <SettingsHeader id="general" title="General Settings" icon={Settings} />
              {openSettingSection === 'general' && (
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

              {/* Categories */}
              <SettingsHeader id="categories" title="Manage Categories" icon={PieChart} />
              {openSettingSection === 'categories' && (
                <div className="p-4 bg-gray-50 border-b border-gray-100 animate-in slide-in-from-top-2">
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
              <SettingsHeader id="notifications" title="Notifications" icon={Bell} />
              {openSettingSection === 'notifications' && (
                <div className="p-4 bg-gray-50 border-b border-gray-100 animate-in slide-in-from-top-2 space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Enable Sound</span>
                    <input type="checkbox" checked={settings.notificationsEnabled} onChange={e => updateSetting('notificationsEnabled', e.target.checked)} className="toggle" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Visual Flash</span>
                    <input type="checkbox" checked={settings.visualFlashEnabled} onChange={e => updateSetting('visualFlashEnabled', e.target.checked)} className="toggle" />
                  </div>
                  <button onClick={() => {
                    audioRef.current.play();
                    setTriggerFlash(true);
                    setTimeout(() => setTriggerFlash(false), 7000);
                  }} className="w-full py-2 bg-indigo-100 text-indigo-700 rounded font-medium text-sm">Test Alarm (7s)</button>
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

      {/* Input */}
      {view === 'day' && (
        <InputBar
          onSubmit={handleLogSubmit}
          onDelete={activeSlotLog ? handleLogDelete : undefined}
          recentTags={tags}
          currentSlotLabel={activeSlotLabel}
          isFocusedSlotFilled={!!activeSlotLog}
          initialText={activeSlotLog?.description ?? ''}
          shouldFocus={alarmActive}
          categories={settings.categories}
          categoryColors={settings.categoryColors}
          onUpdateCategoryColor={(cat, col) => updateSetting('categoryColors', { ...settings.categoryColors, [cat]: col })}
          onAutoTag={(text) => db.findLastCategoryForText(text)}
        />
      )}
    </div>
  );
};

export default App;
