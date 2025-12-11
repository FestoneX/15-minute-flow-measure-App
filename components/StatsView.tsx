import React, { useMemo, useState } from 'react';
import { LogEntry, Category } from '../types';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, isWithinInterval } from '../utils/timeUtils';
import { PieChart as PieIcon, CalendarDays, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  logs: LogEntry[];
  currentDate: Date;
  categoryColors?: Record<string, string>;
  categories?: Category[];
}

const DEFAULT_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#6366F1', '#14B8A6'];

export const StatsView: React.FC<Props> = ({ logs, currentDate, categoryColors = {}, categories = [] }) => {
  const [mode, setMode] = useState<'day' | 'week' | 'compare'>('day');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // Navigation State
  // Default to "Today" (passed as prop, generally) or just new Date()
  const [viewDate, setViewDate] = useState<Date>(new Date());

  // Comparison State
  const [baseDate, setBaseDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [targetDate, setTargetDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1); // Default to yesterday
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Reset to "Today" on mount/default
  // Actually, we want to allow the user to navigate BACK.
  // The prop `currentDate` is from App.tsx, which has its own navigation.
  // Requirement: "History View: Implement a Date Picker... to switch the main view to any specific past date."
  // Note: App.tsx controls `currentDate` via day view navigation.
  // Should we control `currentDate` in App.tsx? Or just local overrides for Stats?
  // User Prompt: "switch the main view to any specific past date".
  // Because StatsView is a child, changing the date here usually implies just viewing stats for that date.
  // Let's use `viewDate` locally for StatsView so we don't disrupt the entry flow in App.tsx if they go back to Day view.
  // BUT, if they switch back to Day View, they might expect to be on the same date?
  // Let's keep it local to StatsView for safely viewing history without messing up logging context? 
  // "switch the main view" -> ambiguous, but safer to implement local state for the Stats Dashboard first.

  const getStatsForRange = (rangeStart: Date, rangeEnd: Date) => {
    const filtered = logs.filter(log =>
      isWithinInterval(new Date(log.timestamp), { start: rangeStart, end: rangeEnd })
    );

    const catGroups: Record<string, { mins: number; tasks: Record<string, number>, color: string }> = {};
    let totalMinutes = 0;

    categories.forEach(cat => {
      catGroups[cat.name] = { mins: 0, tasks: {}, color: cat.color };
    });
    catGroups['Uncategorized'] = { mins: 0, tasks: {}, color: '#9CA3AF' };

    filtered.forEach(log => {
      const rawCat = log.category;
      let targetGroupName = 'Uncategorized';
      if (rawCat && catGroups[rawCat]) {
        targetGroupName = rawCat;
      }

      catGroups[targetGroupName].mins += 15;
      const desc = log.description || '(No description)';
      catGroups[targetGroupName].tasks[desc] = (catGroups[targetGroupName].tasks[desc] || 0) + 15;
      totalMinutes += 15;
    });

    const data = Object.entries(catGroups)
      .filter(([_, group]) => group.mins > 0)
      .map(([name, group]) => ({
        name,
        value: group.mins,
        percentage: totalMinutes > 0 ? (group.mins / totalMinutes) * 100 : 0,
        tasks: Object.entries(group.tasks)
          .map(([desc, mins]) => ({ desc, mins }))
          .sort((a, b) => b.mins - a.mins),
        color: group.color || categoryColors[name]
      }))
      .sort((a, b) => b.value - a.value);

    // Fallback colors
    data.forEach((item, idx) => {
      if (!item.color) item.color = DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
    });

    return { data, totalMinutes };
  };

  const primaryStats = useMemo(() => {
    let start, end;
    if (mode === 'week') {
      start = startOfWeek(viewDate, { weekStartsOn: 1 });
      end = endOfWeek(viewDate, { weekStartsOn: 1 });
    } else {
      start = startOfDay(viewDate);
      end = endOfDay(viewDate);
    }
    return getStatsForRange(start, end);
  }, [logs, viewDate, mode, categoryColors, categories]);

  const comparisonBaseStats = useMemo(() => {
    if (mode !== 'compare') return null;
    return getStatsForRange(startOfDay(baseDate), endOfDay(baseDate));
  }, [logs, baseDate, mode, categoryColors, categories]);

  const comparisonTargetStats = useMemo(() => {
    if (mode !== 'compare') return null;
    return getStatsForRange(startOfDay(targetDate), endOfDay(targetDate));
  }, [logs, targetDate, mode, categoryColors, categories]);

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const StatCard = ({ title, stats, dateLabel, dateValue, onDateChange }: any) => (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex-1">
      <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">{title}</h3>

      {onDateChange ? (
        <div className="mb-4">
          <input
            type="date"
            value={dateValue ? dateValue.toISOString().split('T')[0] : ''}
            onChange={(e) => {
              if (e.target.value) {
                const d = new Date(e.target.value);
                d.setHours(0, 0, 0, 0);
                // Fix UTC offset issue by using manual parse or safer method?
                // Standard trick: 
                const parts = e.target.value.split('-');
                const local = new Date(+parts[0], +parts[1] - 1, +parts[2]);
                onDateChange(local);
              }
            }}
            className="text-lg font-bold text-indigo-900 border-b border-dashed border-gray-300 focus:border-indigo-500 outline-none bg-transparent w-full"
          />
        </div>
      ) : (
        <div className="text-xl font-bold text-indigo-900 mb-4">{dateLabel}</div>
      )}


      {/* Pie Chart */}
      <div className="h-40 relative mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={stats.data}
              innerRadius={35}
              outerRadius={55}
              paddingAngle={4}
              dataKey="value"
            >
              {stats.data.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatDuration(value)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <span className="text-xl font-bold text-gray-800">{formatDuration(stats.totalMinutes)}</span>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {stats.data.length === 0 && <div className="text-center text-gray-400 italic py-4">No data</div>}
        {stats.data.map((cat: any) => (
          <div key={cat.name}>
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                <span className="font-medium text-gray-700">{cat.name}</span>
              </div>
              <span className="font-mono text-gray-500">{formatDuration(cat.value)}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Mode Toggle */}
      <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 flex justify-center w-full max-w-sm mx-auto mb-6">
        <button onClick={() => setMode('day')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'day' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Day</button>
        <button onClick={() => setMode('week')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'week' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Week</button>
        <button onClick={() => setMode('compare')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'compare' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Compare</button>
      </div>

      {mode === 'compare' ? (
        <div className="flex flex-col md:flex-row gap-4">
          {/* Base Date */}
          <StatCard
            title="Base Date (A)"
            stats={comparisonBaseStats}
            dateValue={baseDate}
            onDateChange={setBaseDate}
          />

          {/* Target Date */}
          <StatCard
            title="Target Date (B)"
            stats={comparisonTargetStats}
            dateValue={targetDate}
            onDateChange={setTargetDate}
          />
        </div>
      ) : (
        // Standard Day/Week View
        <div>
          {/* History Navigation for Day/Week View */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <button onClick={() => { const d = new Date(viewDate); d.setDate(d.getDate() - 1); setViewDate(d); }} className="p-2 hover:bg-white rounded-full"><ChevronDown className="rotate-90" /></button>
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-wide">{mode === 'week' ? 'Week Of' : 'Viewing'}</span>
              <input
                type="date"
                value={viewDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  if (e.target.value) {
                    const parts = e.target.value.split('-');
                    const local = new Date(+parts[0], +parts[1] - 1, +parts[2]);
                    setViewDate(local);
                  }
                }}
                className="text-xl font-bold text-gray-800 bg-transparent border-none outline-none text-center cursor-pointer hover:bg-black/5 rounded px-2 transition-colors"
              />
            </div>
            <button onClick={() => { const d = new Date(viewDate); d.setDate(d.getDate() + 1); setViewDate(d); }} className="p-2 hover:bg-white rounded-full"><ChevronRight /></button>
          </div>

          <StatCard
            title={mode === 'week' ? 'Weekly Overview' : 'Daily Overview'}
            stats={primaryStats}
            dateLabel={mode === 'week' ? 'Current Week' : viewDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          />
        </div>
      )}
    </div>
  );
};
