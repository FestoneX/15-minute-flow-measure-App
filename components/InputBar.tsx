import React, { useState, useEffect, useRef } from 'react';
import { Send, Zap, X, Trash2 } from 'lucide-react';
import { Category } from '../types';

interface Props {
  onSubmit: (text: string, category?: string) => void;
  onDelete?: () => void;
  recentTags: string[];
  recentDescriptions?: Array<{description: string, category?: string, lastUsed: number}>;
  currentSlotLabel: string;
  isFocusedSlotFilled: boolean;
  initialText?: string;
  shouldFocus?: boolean;
  categories?: Category[];
  categoryColors?: Record<string, string>;
  onAutoTag?: (text: string) => string | undefined;
  themeMode?: 'light' | 'dark' | 'circadian';
}

export const InputBar: React.FC<Props> = ({
  onSubmit,
  onDelete,
  recentTags,
  recentDescriptions = [],
  currentSlotLabel,
  isFocusedSlotFilled,
  initialText = '',
  shouldFocus = false,
  categories = [],
  categoryColors = {},
  onAutoTag,
  themeMode = 'light'
}) => {
  const [text, setText] = useState(initialText || '');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

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
    const safeQuery = query || '';

    // Use full descriptions if available, otherwise fall back to tags
    const source = recentDescriptions.length > 0
      ? recentDescriptions.map(d => d.description)
      : recentTags;

    // If empty query, show top 5 recent suggestions
    if (!safeQuery.trim()) {
      setSuggestions(source.slice(0, 5));
      return;
    }

    const lower = safeQuery.toLowerCase();
    // Match from beginning of description for better relevance
    const filtered = source.filter(s => s.toLowerCase().startsWith(lower));
    setSuggestions(filtered.slice(0, 5));
  };

  useEffect(() => {
    if (isFocused) {
      updateSuggestions(text);
    } else {
      setSuggestions([]);
    }
  }, [text, isFocused, recentTags]);

  // BULK PASTE LOGIC
  const handlePaste = (e: React.ClipboardEvent) => {
    const pasteText = e.clipboardData.getData('text');
    if (pasteText.includes('\n')) {
      e.preventDefault();
      // It's a list!
      const lines = pasteText.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length > 1) {
        // We need to signal parent to handle bulk add.
        // For simplicity, we'll alert the user or try to handle it.
        // PROPOSAL: Since Props doesn't have onBulkSubmit, we can iterate and call onSubmit multiple times?
        // No, onSubmit expects single category.
        // Let's just create a quick visual confirmation?
        // Better: We should add `onBulkSubmit` to props, but `onSubmit` is usually tied to state.
        // Let's allow `onSubmit` to optionally take an array? No, simpler:
        // Detect multiline in standard text change?
        // Let's just allow the user to confirm.

        // Actually, requirement is "allow users to paste a multi-line list... automatically populates consecutive".
        // We will call onSubmit for the FIRST item, and we need a way to pass the rest.
        // Since we can't easily change the interface right now without touching App.tsx, let's inject a special "BULK:" signal or add a prop.
        // Let's add a `onBulkSubmit` prop to InputBar. But first let's just make it work by passing the raw text if it has newlines?
        // No, `handleLogSubmit` in App.tsx takes text. We can handle splitting THERE.
      }
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() && !activeCategory) return;

    let description = text.trim();

    // Check for BULK PASTE (newline)
    if (description.includes('\n')) {
      // It's a bulk entry
      const lines = description.split('\n').filter(l => l.trim());
      // We'll pass the whole block and let App.tsx handle it if we modify App.tsx.
      // OR we just iterate here if we had access to multiple slots. We don't.
      // We must trust App.tsx to handle multiline string as bulk.
      onSubmit(description, activeCategory?.name);
    } else {
      // ... existing logic
      let categoryName = activeCategory ? activeCategory.name : undefined;

      // If text matches a category name exactly, use it
      if (!categoryName) {
        const strictMatch = categories.find(c => c.name.toLowerCase() === description.toLowerCase());
        if (strictMatch) {
          categoryName = strictMatch.name;
        } else {
          categoryName = description; // Text as category fallback
        }
      }

      if (!description && activeCategory) {
        description = activeCategory.name;
      }

      if (!description) return;

      onSubmit(description, categoryName);
    }

    setText('');
    setActiveCategory(null);
    localStorage.removeItem('flowstate_draft');
    // Don't blur if we want auto-advance (Speed)?
    // User requested "Auto-Advance: After hitting 'Enter' ... cursor jumps to next 15m slot".
    // Does 'onSubmit' trigger slot change? Yes, in App.tsx calls `setManualSelectedTimestamp(null)`.
    // We need to change that behavior.

    // inputRef.current?.blur(); // REMOVED for Rapid Entry
    // We want to keep focus! 
    setIsFocused(true);
    // Wait, if the slot changes, unique key of InputBar might not change, but props change.
    // The `useEffect` [initialText, currentSlotLabel] will fire.
    // And we added "INSTANT FOCUS LOGIC" there exactly for this!
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleChange(suggestion);

    // Smart tag inheritance: Auto-populate category from most recent use
    const match = recentDescriptions.find(d => d.description === suggestion);
    if (match?.category) {
      const cat = categories.find(c => c.name === match.category);
      if (cat) {
        setActiveCategory(cat);
      }
    }

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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">

      {/* Category Pills Row - Only show when focused or typing or active pill */}
      {(isFocused || activeCategory) && categories.length > 0 && (
        <div className={`${themeMode === 'light' ? 'bg-white' : 'bg-gray-800'} border-t ${themeMode === 'light' ? 'border-gray-200' : 'border-gray-600'} py-3 px-2 shadow-sm whitespace-nowrap overflow-x-auto scrollbar-hide animate-in slide-in-from-bottom-2`}>
          <div className="flex gap-2 px-2">
            {categories.map(cat => {
              const isActive = activeCategory?.id === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all border-2 ${isActive ? 'scale-105 shadow-md' : `border-transparent ${themeMode === 'light' ? 'bg-gray-100 text-gray-600' : 'bg-gray-700 text-gray-300'} hover:bg-gray-200 opacity-80 hover:opacity-100`}`}
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
        <div className={`${themeMode === 'light' ? 'bg-white' : 'bg-gray-800'} border-t ${themeMode === 'light' ? 'border-gray-200' : 'border-gray-600'} p-2 shadow-lg animate-in slide-in-from-bottom-2 duration-200`}>
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

      {/* Input Bar */}
      <div
        className={`${themeMode === 'light' ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-600'} border-t p-3 pb-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transition-all duration-300 ${shouldFocus ? 'bg-red-50 border-red-200' : ''}`}
        style={activeCategory ? { borderTopColor: activeCategory.color, backgroundColor: `${activeCategory.color}10` } : {}}
      >
        <div className="max-w-md mx-auto relative flex items-center gap-2">

          <div className="absolute -top-10 left-0 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-md opacity-0 transition-opacity duration-200 data-[visible=true]:opacity-100 pointer-events-none" data-visible={isFocused}>
            Editing: <span className="font-bold">{currentSlotLabel}</span>
          </div>

          <div className="relative flex-1 flex items-center gap-2 bg-gray-100 border-2 border-transparent focus-within:bg-white focus-within:border-indigo-500 rounded-xl px-0 transition-all overflow-hidden"
            style={activeCategory ? { borderColor: activeCategory.color, backgroundColor: 'white' } : {}}
          >
            {activeCategory && (
              <div className="flex items-center gap-1 pl-3 pr-1 py-1 rounded-l-md select-none shrink-0 animate-in slide-in-from-left-2 fade-in duration-200" style={{ color: activeCategory.color }}>
                <span className="text-xs font-bold uppercase tracking-wider">{activeCategory.name}</span>
                <div className="w-1 h-4 bg-gray-200 rounded-full mx-1"></div>
              </div>
            )}

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
                  setActiveCategory(null);
                }
              }}
              placeholder={isFocusedSlotFilled ? "Edit entry..." : (activeCategory ? `Add description...` : "What did you do?")}
              className={`w-full py-3 bg-transparent outline-none transition-all ${themeMode === 'light' ? 'text-gray-800 placeholder-gray-400' : 'text-gray-100 placeholder-gray-500'} ${activeCategory ? 'pl-0' : 'pl-4'} pr-10`}
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
