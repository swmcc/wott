/** The user object returned by `POST /auth/login` and `GET /auth/me` (API.md § Auth). */
export interface User {
	id: number;
	email: string;
	username: string;
	first_name: string | null;
	last_name: string | null;
	created_at: string;
	updated_at: string;
}
