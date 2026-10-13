// A Map, so a crafted `?error=__proto__` or `constructor` finds nothing instead of an object.
const ERRORS = new Map([
  ["link", "That sign-in link has expired or was already used. Ask for a new one below."],
  ["google", "Google sign-in did not go through. Try again, or use your email."],
]);

/** The sentence for a sign-in error code from the query string, or undefined for any other value. */
export const loginError = (code: string | undefined): string | undefined => (code === undefined ? undefined : ERRORS.get(code));
