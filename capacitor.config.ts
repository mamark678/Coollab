import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.coollab.app',
  appName: 'Coollab',
  webDir: 'dist-web',
  server: {
    androidScheme: 'https'
  }
};

export default config;