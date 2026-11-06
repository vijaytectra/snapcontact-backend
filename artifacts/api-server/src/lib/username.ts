/** Usernames are case-insensitive: stored and compared in lower case. */
export const USERNAME_RULES = 'Use 3 to 30 letters, numbers, dots or underscores.';
const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

export const normalizeUsername = (username: string) => username.trim().toLowerCase();

export const isValidUsername = (username: string) => USERNAME_PATTERN.test(username);
