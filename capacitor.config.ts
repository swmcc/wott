import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'tv.whatisonthe.wott',
	appName: 'WOTT',
	webDir: 'build'
};

// Dev-only: `CAP_DEV_CLEARTEXT=1 npx cap sync` lets a device/emulator build
// talk to a plain-http backend on the host Mac (pair with
// VITE_API_BASE=http://10.0.2.2:8000/api for the Android emulator).
// Never set for release builds.
if (process.env.CAP_DEV_CLEARTEXT) {
	config.server = { androidScheme: 'http', cleartext: true };
}

export default config;
