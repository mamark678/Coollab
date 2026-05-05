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
      serverClientId: '251672582118-ibutjdrkvhhmsd57sv28vubll6qb2cgm.apps.googleusercontent.com',
    },
  },
};

export default config;