const JWT_SECRET_PLACEHOLDERS = new Set([
  "replace_with_a_secure_random_jwt_secret",
  "replace_with_a_strong_jwt_secret",
  "your_jwt_secret_here",
  "your_jwt_secret",
  "jwt_secret",
  "change-me-in-production",
  "changeme",
  "default",
  "secret",
  "undefined",
  "null",
]);

export const isExampleJwtSecret = (secret) => {
  const normalizedSecret = secret.trim().toLowerCase();

  return (
    JWT_SECRET_PLACEHOLDERS.has(normalizedSecret) ||
    /^<[^>]+>$/.test(normalizedSecret) ||
    /^\[[^\]]+\]$/.test(normalizedSecret)
  );
};

export const getJwtSecret = () => {
  const jwtSecret = process.env.JWT_SECRET?.trim();

  if (!jwtSecret || isExampleJwtSecret(jwtSecret)) {
    throw new Error(
      "JWT_SECRET must be set to a non-placeholder value before starting authentication",
    );
  }

  return jwtSecret;
};

export const validateAuthConfiguration = () => {
  getJwtSecret();
};
