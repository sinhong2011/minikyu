declare module '@willh/opencc-js' {
  export type OpenCCLocale = 'cn' | 'tw' | 'twp' | 'hk' | 'jp' | 't';

  export function Converter(options: {
    from: OpenCCLocale;
    to: OpenCCLocale;
  }): (text: string) => string;
}

declare module '@willh/opencc-js/cn2t' {
  export type OpenCCLocale = 'cn' | 'tw' | 'twp' | 'hk' | 'jp' | 't';

  export function Converter(options: {
    from: OpenCCLocale;
    to: OpenCCLocale;
  }): (text: string) => string;
}

declare module '@willh/opencc-js/t2cn' {
  export type OpenCCLocale = 'cn' | 'tw' | 'twp' | 'hk' | 'jp' | 't';

  export function Converter(options: {
    from: OpenCCLocale;
    to: OpenCCLocale;
  }): (text: string) => string;
}
