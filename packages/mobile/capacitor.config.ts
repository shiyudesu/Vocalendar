import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.vocalendar.mobile',
  appName: 'Vocalendar',
  webDir: '../web/dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
