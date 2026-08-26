// Generate local, untracked signing secrets for the Aeko backend.
// Usage: node JWT_SECRET_GENERATOR.js [--with-password-reset-secret]

import crypto from "crypto";

const generateSecret = () => crypto.randomBytes(64).toString("hex");
const configurationStatus = (name) =>
  process.env[name]?.trim() ? "configured" : "not configured";

const jwtSecret = generateSecret();
const includePasswordResetSecret = process.argv.includes(
  "--with-password-reset-secret",
);

console.log("Generated JWT secret. Copy it only into your untracked .env file:");
console.log(`JWT_SECRET=${jwtSecret}`);
console.log("");

if (includePasswordResetSecret) {
  console.log("Optional independently managed password-reset signing secret:");
  console.log(`PASSWORD_RESET_JWT_SECRET=${generateSecret()}`);
} else {
  console.log(
    "Password-reset tokens derive a purpose-bound key from JWT_SECRET by default.",
  );
  console.log(
    "Use --with-password-reset-secret only when an independent reset-token secret is required.",
  );
}

console.log("");
console.log(
  "Email credentials are read from environment variables and are never printed:",
);
for (const variableName of [
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "ZEPTOMAIL_API_URL",
  "ZEPTOMAIL_API_KEY",
  "EMAIL_USER",
  "EMAIL_PASS",
]) {
  console.log(`${variableName}: ${configurationStatus(variableName)}`);
}

console.log("");
console.log("Do not commit generated secrets or provider credentials.");
