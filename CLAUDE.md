# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FlowState 15m Logger** is a React-based time-tracking application that logs activities in 15-minute time slots throughout the day. It's a productivity/time management tool with analytics, customizable categories, themes (including a circadian rhythm mode), and various notification options.

## Tech Stack

- **Framework**: React 19.2.1 with TypeScript 5.8.2
- **Build Tool**: Vite 6.2.0
- **Styling**: Tailwind CSS (via CDN), custom CSS variables (oklch color system)
- **UI Components**: Lucide React for icons
- **Charts**: Recharts 2.15.0
- **State Management**: React useState hooks (centralized in App.tsx)
- **Storage**: LocalStorage via custom abstraction layer (services/db.ts)

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build (port 4173)
npm run preview
```

## Architecture Overview

### Application Structure

The app follows a centralized state management pattern with most state in `App.tsx`. Key architectural layers:

1. **App.tsx** (39K+ lines): Main application component containing:
   - All application state (20+ useState hooks)
   - View routing logic (day/stats/settings)
   - Time slot generation and current time tracking
   - Notification and alarm system
   - 30-second interval updates for real-time slot tracking

2. **Service Layer** (`services/db.ts`): LocalStorage abstraction providing:
   - CRUD operations for logs, settings, tags, and daily notes
   - Smart autocomplete with weighted suggestions (recency-based scoring)
   - Auto-tagging logic (remembers category for similar descriptions)
   - Data backup/export and restore functionality
   - Activity tracking for refresh button logic

3. **Components**: Presentational and container components
   - `InputBar.tsx`: Activity input with smart suggestions and category selection
   - `StatsView.tsx`: Analytics dashboard with charts (day/week/compare views)
   - `TimeSlotItem.tsx`: Individual time slot display
   - `DamageFlash.tsx`: Visual feedback for alarms (red vignette effect)

4. **Utilities**:
   - `utils/timeUtils.ts`: Date/time functions for slot generation
   - `utils/colorUtils.ts`: Color manipulation for themes and contrast

### Data Flow

```
App.tsx (state) → Components (props) → db.ts (persistence) → localStorage
```

### Key Data Models

Defined in `types.ts`:
- `LogEntry`: Activity records with timestamp, description, category
- `Category`: ID, name, and color for activity categories
- `AppSettings`: User preferences (13+ fields including hours, notifications, theme, sounds)
- `DailyNote`: Per-date free-form text notes
- `TimeSlot`: Generated slots with current/past status

### LocalStorage Keys

Defined in `constants.ts`:
- `flowstate_logs`: All log entries
- `flowstate_tags`: Tag history for autocomplete
- `flowstate_settings`: User settings
- `flowstate_daily_notes`: Daily notes
- `flowstate_last_activity`: For refresh button logic

## Key Features & Implementation Details

### Time Slot System
- 15-minute intervals calculated from `startHour` to `endHour` settings
- Current slot detected with real-time updates (30-second intervals)
- Slots generated via `timeUtils.ts` functions
- Manual slot selection for editing past/future entries

### Smart Auto-tagging
- `db.findLastCategoryForText()` remembers category for matching descriptions
- Searches last 30 days of history for relevance
- Exact match on description text (case-insensitive)

### Weighted Suggestions
- `db.getWeightedSuggestions()` ranks tags by recency and frequency
- Time decay multipliers: 1.0 (48h), 0.8 (day 3), 0.2 (week), 0.1 (2+ weeks), 0.0 (6+ months)
- Autocomplete cache limited to 100 items

### Category System
- 5 default categories: Work, Deep Work, Meetings, Errands, Misc
- Colors in `PRESET_CATEGORY_COLORS` (10 preset colors available)
- Category colors propagate to time slot UI
- Legacy `categoryColors` map still supported

### Theme System
- Three themes: Light, Dark, Circadian
- **Circadian mode**: Time-based colors from `CIRCADIAN_TIME_MAP`
  - 6 time ranges with smooth color interpolation
  - Example: 6-10am transitions from mauve to warm grey
- Color utilities handle contrast calculation (YIQ formula)

### Notification System
- Browser notifications at specified times
- Visual flash effect (`DamageFlash.tsx`) with red vignette
- Screen shake animation
- Sound library in `constants.ts`: chime, beep, retro (base64 encoded)
- Global mute toggle and temporary mute functionality

## Configuration

### Environment Variables
Set `GEMINI_API_KEY` in `.env.local` for AI integration features.

### Vite Configuration
- Dev server: port 3000, host 0.0.0.0
- Path alias: `@/` maps to project root
- API keys exposed via `define` in vite.config.ts

## Important Implementation Notes

### When Modifying Time Logic
- Always use utilities from `utils/timeUtils.ts` for consistency
- Respect `startHour` and `endHour` from settings
- Remember 15-minute slots are the fundamental unit

### When Adding New Settings
- Update `AppSettings` interface in `types.ts`
- Add default value in `constants.ts` `DEFAULT_SETTINGS`
- Update `db.getSettings()` merge logic in `services/db.ts`

### When Working with Categories
- Use the structured `categories` array, not legacy `categoryColors`
- Category IDs should be kebab-case strings
- Colors should be hex format (#RRGGBB)

### When Adding Storage Keys
- Define in `STORAGE_KEYS` or `NEW_STORAGE_KEYS` in `constants.ts`
- Use `db.ts` abstraction layer, never direct localStorage access
- Add error handling via try-catch

### Performance Considerations
- Autocomplete cache limited to 100 items
- Tag suggestions limited to 8 items
- Real-time updates throttled to 30-second intervals
- Consider impact of large log arrays on filtering/sorting operations

## Color System

Uses oklch() color space for perceptual uniformity. Custom properties defined in `Global.css`:
- Primary colors use oklch format
- Contrast-aware text color selection
- Circadian theme has 5 base colors with interpolation between time ranges

## Recent Feature Additions

Based on git history:
- Analytics navigation with multiple view modes
- Audio settings with multiple sound options
- Circadian theme implementation
- Smart ranking for suggestions
- Inline tag selection
- Rapid entry improvements
