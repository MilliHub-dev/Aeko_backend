/**
 * Access tokens issued before a password change carry an older version. Tokens
 * created before this claim existed are treated as version zero for backward
 * compatibility with users who have not changed their password since rollout.
 */
export const hasCurrentAuthTokenVersion = (decodedToken, user) => {
  const tokenVersion = Number.isInteger(decodedToken?.authTokenVersion)
    ? decodedToken.authTokenVersion
    : 0;

  return tokenVersion === user.authTokenVersion;
};
