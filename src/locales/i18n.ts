// 类型定义
export type Locale = 'en' | 'zh';

// 内置最小英文保底字典，防止语言包加载失败时完全无文本
const FALLBACK_DICTIONARY: any = {
  common: { close: 'Close', cancel: 'Cancel', save: 'Save' }
};

// 尝试加载语言包，失败时使用保底字典
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
  zhMessages = enMessages; // 回退到英文
}

const messages: Record<Locale, any> = {
  en: enMessages,
  zh: zhMessages,
};

/**
 * 安全翻译函数：任何情况下都不会抛出异常
 */
function safeTranslate(
  locale: Locale,
  key: string,
  params?: Record<string, any>,
  fallbackLocale: Locale = 'en'
): string {
  try {
    // 1. 按点分割路径
    const keys = key.split('.');
    
    // 2. 在当前语言中查找
    let result = messages[locale];
    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        result = undefined;
        break;
      }
    }
    
    // 3. 未找到则回退到英文
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
    
    // 4. 仍然未找到，返回原始 key（比空白好）
    if (typeof result !== 'string') {
      return key;
    }
    
    // 5. 插值处理（安全包裹）
    if (params) {
      Object.keys(params).forEach(p => {
        result = result.replace(new RegExp(`{${p}}`, 'g'), String(params[p]));
      });
      // 简单复数处理
      if (params.count !== undefined) {
        result = result.replace(/{count, plural, one{(.*?)} other{(.*?)}}/g,
          (_, one, other) => (params.count === 1 ? one : other)
        );
      }
    }
    
    return result;
  } catch (e) {
    console.error(`[i18n] Translation error for key "${key}"`, e);
    return key; // 最终保底：返回键名
  }
}

// 创建单例
class I18n {
  private _locale: Locale = 'en';
  
  constructor() {
    // 从浏览器检测语言，但仅在安全情况下设置
    try {
      const browserLang = navigator.language?.split('-')[0];
      if (browserLang === 'zh') this._locale = 'zh';
    } catch (e) {
      // navigator 不存在（SSR 等），忽略
    }
  }
  
  t(key: string, params?: Record<string, any>): string {
    return safeTranslate(this._locale, key, params);
  }
  
  get locale(): Locale {
    return this._locale;
  }
  
  set locale(lang: Locale) {
    if (messages[lang]) {
      this._locale = lang;
    }
  }
}

export const i18n = new I18n();
export const t = i18n.t.bind(i18n);