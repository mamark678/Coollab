import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.coollab.app',
  appName: 'Coollab',
  webDir: 'dist-web',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    GoogleSignIn: {
      serverClientId: '251672582118-n3sip0i77t89hlld431o93o1rgvs0fgs.apps.googleusercontent.com',
    },
  },
};

export default config;