# Internationalization (i18n) Strategy

This project uses **react-i18next** for internationalization with RTL support.

## Current Setup

- **Library:** react-i18next v16
- **Locales:** English (en), Arabic (ar) with RTL support
- **Language switching:** Runtime locale detection
- **RTL Support:** Automatic `dir` and `lang` attribute updates on HTML element

## Why react-i18next?

### Advantages

- **Production-ready** - Stable, well-tested, battle-hardened
- **Simple API** - Easy to use, minimal boilerplate
- **Built-in features** - Namespace support, interpolation, pluralization
- **DevTools integration** - React DevTools for debugging
- **Active community** - Large ecosystem, extensive plugins

## Configuration

**File:** `src/i18n/config.ts`

```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        /* ... */
      },
    },
    ar: {
      translation: {
        /* ... */
      },
    },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})
```

## Usage

### React Components

```tsx
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()
  return <h1>{t('myFeature.title')}</h1>
}
```

### Non-React Contexts

```typescript
import i18n from '@/i18n/config'

const t = i18n.t.bind(i18n)
console.log(t('someKey'))
```

## RTL Support

Arabic locale (ar) automatically:

- Sets `dir="rtl"` on HTML element
- Updates CSS logical properties support via Tailwind
- Flips layout direction

## Future Considerations: Lingui Migration

The project considered migrating to **Lingui** with SWC compiler, but deferred due to incomplete research.

### Potential Benefits

- **Compile-time translations** - Extract strings at build time
- **SWC compiler** - Faster than Babel
- **Type-safe keys** - No runtime string typos
- **Plural ICU format** - Built-in pluralization

### Migration Threshold

Lingui migration will be revisited when:

- Complete research on SWC integration is available
- Performance profiling indicates need for compile-time optimization
- Production requirements demand advanced pluralization

### Migration Plan (Future)

1. Install Lingui packages
2. Configure Vite plugin with SWC
3. Extract existing translations
4. Update all `t()` calls to Lingui macro
5. Set up build-time extraction
6. Test locale switching and RTL support

## Recommendations

**Current approach (react-i18next) is recommended for most projects because:**

- ✅ Works perfectly out of the box
- ✅ No build complexity
- ✅ Easy for contributors to learn
- ✅ Excellent documentation
- ✅ Production-ready

**Consider Lingui migration when:**

- 📎 You need compile-time translation extraction
- 📎 Type safety is a hard requirement
- 📎 You have 10+ locales with complex pluralization
- 📎 Build performance is becoming a bottleneck

## References

- [react-i18next Documentation](https://react.i18next.com)
- [i18next Documentation](https://www.i18next.com)
- [Lingui Documentation](https://lingui.dev)
