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
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const stats = useMemo(() => {
    let start, end;
    if (mode === 'day') {
      start = startOfDay(currentDate);
      end = endOfDay(currentDate);
    } else {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    }

    const filtered = logs.filter(log =>
      isWithinInterval(new Date(log.timestamp), { start, end })
    );

    // Group by Category (Predefined)
    const catGroups: Record<string, { mins: number; tasks: Record<string, number>, color: string }> = {};
    let totalMinutes = 0;

    // Initialize groups from settings
    categories.forEach(cat => {
      catGroups[cat.name] = {
        mins: 0,
        tasks: {},
        color: cat.color
      };
    });

    // Explicit "Uncategorized" group
    catGroups['Uncategorized'] = { mins: 0, tasks: {}, color: '#9CA3AF' };

    filtered.forEach(log => {
      const rawCat = log.category;
      let targetGroupName = 'Uncategorized';

      // Check if it matches a known category
      if (rawCat && catGroups[rawCat]) {
        targetGroupName = rawCat;
      }

      // Add to group
      catGroups[targetGroupName].mins += 15;

      // Track description inside the group
      // If it's uncategorized, the description is the log description.
      // If it's categorized, we still just list the description.
      const desc = log.description || '(No description)';
      catGroups[targetGroupName].tasks[desc] = (catGroups[targetGroupName].tasks[desc] || 0) + 15;

      totalMinutes += 15;
    });

    const data = Object.entries(catGroups)
      .filter(([_, group]) => group.mins > 0) // Only show groups with data
      .map(([name, group]) => ({
        name,
        value: group.mins,
        percentage: totalMinutes > 0 ? (group.mins / totalMinutes) * 100 : 0,
        tasks: Object.entries(group.tasks)
          .map(([desc, mins]) => ({ desc, mins }))
          .sort((a, b) => b.mins - a.mins),
        color: group.color || categoryColors[name]
      }))
      .sort((a, b) => {
        if (a.name === 'Uncategorized') return 1; // Always last
        if (b.name === 'Uncategorized') return -1;
        return b.value - a.value;
      });

    // Assign fallback colors if missing
    data.forEach((item, idx) => {
      if (!item.color) {
        item.color = DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
      }
    });

    return { data, totalMinutes };
  }, [logs, currentDate, mode, categoryColors, categories]);

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const toggleExpand = (name: string) => {
    setExpandedCat(expandedCat === name ? null : name);
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex bg-gray-200 rounded-lg p-1 mb-6">
        <button
          onClick={() => setMode('day')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${mode === 'day' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <PieIcon size={16} /> Daily
        </button>
        <button
          onClick={() => setMode('week')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${mode === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <CalendarDays size={16} /> Weekly
        </button>
      </div>

      {stats.data.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <PieIcon size={48} className="mx-auto mb-3 opacity-20" />
          <p>No data recorded for this {mode}.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
            <span className="text-indigo-200 text-sm font-medium uppercase tracking-wider">Total Tracked</span>
            <div className="text-4xl font-bold mt-1">{formatDuration(stats.totalMinutes)}</div>
          </div>

          {/* Chart */}
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.data}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {stats.data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#ccc'} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800">{stats.data.length}</div>
                <div className="text-xs text-gray-400 uppercase">Groups</div>
              </div>
            </div>
          </div>

          {/* Accordion List */}
          <div className="space-y-3">
            {stats.data.map((item, idx) => {
              const isExpanded = expandedCat === item.name;
              return (
                <div key={idx} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
                  {/* Header */}
                  <button
                    onClick={() => toggleExpand(item.name)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color || '#ccc' }}></div>
                      <span className="font-medium text-gray-700">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-gray-900 font-medium">{formatDuration(item.value)}</span>
                      <span className="text-xs text-gray-400 w-8 text-right">{Math.round(item.percentage)}%</span>
                      {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    </div>
                  </button>

                  {/* Details */}
                  {isExpanded && (
                    <div className="bg-gray-50 border-t border-gray-100 p-3 space-y-2 animate-in slide-in-from-top-2">
                      {item.tasks.map((task, tIdx) => (
                        <div key={tIdx} className="flex justify-between items-start text-sm px-2">
                          <span className="text-gray-600 flex-1">{task.desc}</span>
                          <span className="font-mono text-gray-500 font-medium ml-4">{formatDuration(task.mins)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
