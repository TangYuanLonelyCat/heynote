import { App, Plugin, ref, reactive, computed } from 'vue';

// Type definitions
export type Locale = 'en' | 'zh';

// Built-in minimal English fallback dictionary to prevent missing text when locale loading fails
const FALLBACK_DICTIONARY: any = {
  common: { close: 'Close', cancel: 'Cancel', save: 'Save' }
};

// Attempt to load locale files, use fallback dictionary on failure
let enMessages: any;
let zhMessages: any;

try {
  enMessages = require('./en.js').default;
} catch (e) {
  console.warn('[i18n] Failed to load English locale, using fallback.');
  enMessages = FALLBACK_DICTIONARY;
}

try {
  zhMessages = require('./zh.js').default;
} catch (e) {
  console.warn('[i18n] Failed to load Chinese locale, using English fallback.');
  zhMessages = enMessages; // Fallback to English
}

const messages: Record<Locale, any> = {
  en: enMessages,
  zh: zhMessages,
};

/**
 * Safe translation function: never throws exceptions
 */
export function safeTranslate(
  locale: Locale,
  key: string,
  params?: Record<string, any>,
  fallbackLocale: Locale = 'en'
): string {
  try {
    // 1. Split path by dots
    const keys = key.split('.');
    
    // 2. Look up in current locale
    let result = messages[locale];
    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        result = undefined;
        break;
      }
    }
    
    // 3. Fallback to English if not found
    if (typeof result !== 'string') {
      result = messages[fallbackLocale];
      for (const k of keys) {
        if (result && typeof result === 'object' && k in result) {
          result = result[k];
        } else {
          result = undefined;
          break;
        }
      }
    }
    
    // 4. Still not found, return original key (better than blank)
    if (typeof result !== 'string') {
      return key;
    }
    
    // 5. Interpolation handling (safely wrapped)
    if (params) {
      Object.keys(params).forEach(p => {
        result = result.replace(new RegExp(`{${p}}`, 'g'), String(params[p]));
      });
      // Simple plural handling
      if (params.count !== undefined) {
        result = result.replace(/{count, plural, one{(.*?)} other{(.*?)}}/g,
          (_, one, other) => (params.count === 1 ? one : other)
        );
      }
    }
    
    return result;
  } catch (e) {
    console.error(`[i18n] Translation error for key "${key}"`, e);
    return key; // Final fallback: return key name
  }
}

// Vue plugin version
export function createI18n(initialLocale: Locale = 'en') {
  const currentLocale = ref<Locale>(initialLocale);
  
  // Detect language from browser
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      const browserLang = navigator.language.split('-')[0] as Locale;
      if (browserLang === 'zh' || browserLang === 'en') {
        currentLocale.value = browserLang;
      }
    }
  } catch (e) {
    // Ignore if navigator is unavailable (SSR, etc.)
  }
  
  // Attempt to get system language from Electron main process
  if (typeof window !== 'undefined' && (window as any).heynote?.getSystemLocale) {
    (window as any).heynote.getSystemLocale().then((systemLocale: string) => {
      const locale = systemLocale.split('-')[0] as Locale;
      if (locale === 'zh' || locale === 'en') {
        currentLocale.value = locale;
      }
    }).catch(() => {});
  }
  
  const t = (key: string, params?: Record<string, any>): string => {
    return safeTranslate(currentLocale.value, key, params);
  };
  
  const setLocale = (locale: Locale) => {
    if (messages[locale]) {
      currentLocale.value = locale;
    }
  };
  
  const i18nApi = {
    global: {
      locale: currentLocale,
      t,
    },
    t,
    locale: computed(() => currentLocale.value),
    setLocale,
  };
  
  const plugin: Plugin = {
    install(app: App) {
      app.config.globalProperties.$t = t;
      app.config.globalProperties.$i18n = {
        locale: currentLocale,
        setLocale,
      };
      app.provide('i18n', i18nApi);
    }
  };
  
  return { ...i18nApi, install: plugin.install, plugin };
}

// Create default instance
export const defaultI18n = createI18n();
export const i18n = defaultI18n;
export const t = defaultI18n.t;

// Compatible with old export style
export default defaultI18n;