import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.misfinanzas.wrapper',
  appName: 'MisFinanzas',
  webDir: 'www',
  server: {
    url: 'https://appfinanzaspersonales.vercel.app',
    cleartext: false,
  },
  android: {
    backgroundColor: '#006960',
  },
};

export default config;
