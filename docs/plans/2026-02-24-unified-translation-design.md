# Unified Translation Experience Design

## Date: 2026-02-24

## Problem

Translation features are split across two separate UIs:
- **Immersive Translation** (provider-based paragraph translation): Globe button in header + TranslationPane in preferences
- **OpenCC Chinese Conversion** (character variant conversion): 中文顯示 button in header + custom rules in AppearancePane

This separation is confusing since both features are text transformation. Additionally, there's no way to exclude specific feeds from immersive translation.

## Design

### 1. Unified Header Popover

Replace two header buttons (Globe + 中文顯示) with a single "Translation" button. The popover has two sections separated by a divider:

**Section: Language Translation**
- Translate toggle (on/off for current article)
- Target language dropdown
- Display mode (Bilingual / Translated only)
- Active provider badge (read-only)
- If current feed is excluded: show muted notice "Translation disabled for this feed", disable translate toggle

**Section: Chinese Display**
- Conversion mode dropdown (Off / 繁體中文台灣 / 繁體中文香港 / 簡體中文)

### 2. Unified TranslationPane in Preferences

Three sections:

**Section: Immersive Translation** (existing, unchanged)
- Provider configuration, routing mode, fallback chains, target language, trigger mode, display mode

**Section: Chinese Conversion** (moved from AppearancePane)
- Conversion mode selector
- Custom conversion rules editor (add/remove/edit from/to pairs)

**Section: Feed Exclusions** (new)
- List of excluded feeds with names and remove buttons
- "Add feed" button opening a searchable feed picker
- Stored as `reader_translation_excluded_feed_ids: Vec<String>` in AppPreferences

### 3. Backend Changes

**AppPreferences** (types.rs):
- Add field: `reader_translation_excluded_feed_ids: Vec<String>` (default: empty vec)
- Feed IDs stored as strings (Miniflux i64 serialization pattern)
- No changes to existing Chinese conversion or translation preference fields

### 4. Exclusion Logic

- Lives in frontend only, no translation routing changes needed
- `EntryReading` checks if `entry.feed_id` is in `excluded_feed_ids`
- If excluded: `translationEnabled = false` (override), show indicator in header popover
- If not excluded: normal behavior (manual/auto trigger as configured)
- OpenCC Chinese conversion always applies regardless of exclusion

### 5. Migration

- Remove Chinese conversion controls from AppearancePane
- Remove 中文顯示 button from EntryReadingHeader
- Remove Globe button from EntryReadingHeader
- Add unified Translation button to EntryReadingHeader
- Move custom conversion rules UI into TranslationPane

## Decisions

- **Exclude from immersive translation only** - OpenCC is a display preference (like font choice), not "translation"
- **Feed-level granularity** - most intuitive; categories don't map cleanly to translation needs
- **Frontend exclusion check** - simpler than adding backend routing logic; prevents unnecessary API calls
- **Sectioned popover over tabs** - fewer controls don't justify tab overhead
