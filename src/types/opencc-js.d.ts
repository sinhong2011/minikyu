declare module 'opencc-js' {
  export type OpenCCLocale = 'cn' | 'tw' | 'twp' | 'hk' | 'jp' | 't';

  export function Converter(options: {
    from: OpenCCLocale;
    to: OpenCCLocale;
  }): (text: string) => string;
}
