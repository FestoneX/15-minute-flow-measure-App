import React, { useState, useEffect, useRef } from 'react';
import { Send, Zap, X, Trash2, Palette } from 'lucide-react';
import { Category } from '../types';

interface Props {
  onSubmit: (text: string, category?: string) => void;
  onDelete?: () => void;
  recentTags: string[];
  currentSlotLabel: string;
  isFocusedSlotFilled: boolean;
  initialText?: string;
  shouldFocus?: boolean;
  categories?: Category[];
  categoryColors?: Record<string, string>;
  onUpdateCategoryColor?: (category: string, color: string) => void;
  onAutoTag?: (text: string) => string | undefined;
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#64748b', // slate
  '#000000', // black
];

export const InputBar: React.FC<Props> = ({
  onSubmit,
  onDelete,
  recentTags,
  currentSlotLabel,
  isFocusedSlotFilled,
  initialText = '',
  shouldFocus = false,
  categories = [],
  categoryColors = {},
  onUpdateCategoryColor,
  onAutoTag
}) => {
  const [text, setText] = useState(initialText || '');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Selection logic for Category Pills
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  // Sync state with props when switching slots
  useEffect(() => {
    setText(initialText || '');
    // If opening an existing log, try to match its category if strictly defined
    setActiveCategory(null);
    localStorage.removeItem('flowstate_draft');

    // INSTANT FOCUS LOGIC: When slot label changes, focus immediately
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [initialText, currentSlotLabel]);

  // Auto-Focus effect (triggered by parent alarm/etc)
  useEffect(() => {
    if (shouldFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [shouldFocus]);

  // Handle Input Change
  const handleChange = (val: string) => {
    setText(val);
    if (val.trim()) {
      localStorage.setItem('flowstate_draft', val);
    } else {
      localStorage.removeItem('flowstate_draft');
    }
  };

  // SMART AUTO-TAGGING LOGIC
  useEffect(() => {
    if (!onAutoTag || !text.trim()) return;

    // Only run if user is typing and we don't have a category yet
    if (activeCategory) return;

    const timer = setTimeout(() => {
      const suggestedCatName = onAutoTag(text);
      if (suggestedCatName) {
        const cat = categories.find(c => c.name === suggestedCatName);
        if (cat) {
          setActiveCategory(cat);
          // Optional: Subtle notification visual could be added here
        }
      }
    }, 600); // 600ms debounce

    return () => clearTimeout(timer);
  }, [text, onAutoTag, categories, activeCategory]);


  const updateSuggestions = (query: string) => {
    // Safety check
    const safeQuery = query || '';
    if (!safeQuery.trim()) {
      setSuggestions(recentTags.slice(0, 8));
      return;
    }
    const lower = safeQuery.toLowerCase();
    const filtered = recentTags.filter(t => t.toLowerCase().includes(lower));
    setSuggestions(filtered.slice(0, 8));
  };

  useEffect(() => {
    if (isFocused) {
      updateSuggestions(text);
    } else {
      setSuggestions([]);
    }
  }, [text, isFocused, recentTags]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() && !activeCategory) return;

    let description = text.trim();
    let categoryName = activeCategory ? activeCategory.name : undefined;

    // If text matches a category name exactly, use it
    if (!categoryName) {
      const strictMatch = categories.find(c => c.name.toLowerCase() === description.toLowerCase());
      if (strictMatch) {
        categoryName = strictMatch.name;
      } else {
        // Text as category fallback
        categoryName = description;
      }
    }

    if (!description && activeCategory) {
      description = activeCategory.name;
    }

    if (!description) return;

    onSubmit(description, categoryName);

    setText('');
    setActiveCategory(null);
    localStorage.removeItem('flowstate_draft');
    setShowColorPicker(false);
    inputRef.current?.blur();
    setIsFocused(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleChange(suggestion);
    inputRef.current?.focus();
  };

  const toggleCategory = (cat: Category) => {
    if (activeCategory?.id === cat.id) {
      setActiveCategory(null);
    } else {
      setActiveCategory(cat);
    }
    inputRef.current?.focus();
  };

  // Determine current effective color for the palette icon
  const effectiveCatName = activeCategory?.name || text.trim();
  const effectiveColor = activeCategory?.color || (categoryColors ? categoryColors[effectiveCatName] : undefined);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">

      {/* Category Pills Row - Only show when focused or typing or active pill */}
      {(isFocused || activeCategory) && categories.length > 0 && (
        <div className="bg-white/95 backdrop-blur-md border-t border-gray-200 py-3 px-2 shadow-sm whitespace-nowrap overflow-x-auto scrollbar-hide animate-in slide-in-from-bottom-2">
          <div className="flex gap-2 px-2">
            {categories.map(cat => {
              const isActive = activeCategory?.id === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all border-2 ${isActive ? 'scale-105 shadow-md' : 'border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200 opacity-80 hover:opacity-100'}`}
                  style={isActive ? { borderColor: cat.color, backgroundColor: 'white', color: cat.color } : {}}
                >
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'animate-pulse' : ''}`} style={{ backgroundColor: cat.color }}></div>
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggestions (Tags) */}
      {isFocused && suggestions.length > 0 && !activeCategory && (
        <div className="bg-white/95 backdrop-blur-md border-t border-gray-200 p-2 shadow-lg animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex flex-wrap gap-2 px-2">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(s)}
                className="px-3 py-1.5 text-sm font-medium rounded-full border bg-gray-50 text-gray-700 border-gray-200 transition-transform active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color Picker (Manual override for text-based tags) */}
      {showColorPicker && (
        <div className="bg-white border-t border-gray-200 p-3 shadow-lg animate-in slide-in-from-bottom-2 flex gap-2 overflow-x-auto">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => {
                if (onUpdateCategoryColor && effectiveCatName) {
                  onUpdateCategoryColor(effectiveCatName, c);
                }
              }}
              className={`w-8 h-8 rounded-full border-2 shadow-sm hover:scale-110 transition-transform flex-shrink-0 ${effectiveColor === c ? 'border-gray-900 scale-110' : 'border-white'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div className={`bg-white border-t border-gray-200 p-3 pb-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transition-colors duration-300 ${shouldFocus ? 'bg-red-50 border-red-200' : ''}`}>
        <div className="max-w-md mx-auto relative flex items-center gap-2">

          <div className="absolute -top-10 left-0 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-md opacity-0 transition-opacity duration-200 data-[visible=true]:opacity-100 pointer-events-none" data-visible={isFocused}>
            Editing: <span className="font-bold">{currentSlotLabel}</span>
          </div>

          {/* Color Toggle Button */}
          {text.trim().length > 0 && !activeCategory && (
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-3 rounded-xl transition-all active:scale-95 shadow-sm border border-gray-200 mr-1 flex items-center justify-center"
              style={{
                backgroundColor: effectiveColor || '#f3f4f6',
                color: effectiveColor ? '#fff' : '#4b5563'
              }}
              title="Pick Color"
            >
              <Palette size={20} />
            </button>
          )}

          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') {
                  inputRef.current?.blur();
                  setIsFocused(false);
                  setShowColorPicker(false);
                  setActiveCategory(null);
                }
              }}
              placeholder={isFocusedSlotFilled ? "Edit entry..." : (activeCategory ? `Add description for ${activeCategory.name}...` : "What did you do?")}
              className="w-full pl-4 pr-10 py-3 bg-gray-100 border-2 border-transparent focus:bg-white focus:border-indigo-500 rounded-xl outline-none transition-all text-gray-800 placeholder-gray-400"
            />
            {text.length > 0 && (
              <button
                onClick={() => setText('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {isFocusedSlotFilled && onDelete ? (
            <button
              onClick={onDelete}
              className="p-3 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-all"
              title="Delete Entry"
            >
              <Trash2 size={20} />
            </button>
          ) : null}

          <button
            onClick={() => handleSubmit()}
            disabled={!text.trim() && !activeCategory}
            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all shadow-md shadow-indigo-200"
          >
            {text.trim() || activeCategory ? <Send size={20} /> : <Zap size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};
