// Compile-time base with an env override so device builds can target any
// backend — e.g. VITE_API_BASE=http://10.0.2.2:8000/api for an Android
// emulator talking to a backend on the host Mac.
export const API_BASE: string =
	(import.meta.env.VITE_API_BASE as string | undefined) ??
	(import.meta.env.DEV ? 'http://localhost:8000/api' : 'https://whatisonthe.tv/api');
