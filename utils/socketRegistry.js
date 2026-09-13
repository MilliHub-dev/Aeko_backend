/**
 * Access to the Socket.IO server from code that has no `req`.
 *
 * Routes reach it through `req.app.get("io")`, but services such as
 * notificationService are called from routes, sockets and jobs alike, so they
 * read it from here instead. `server.js` registers it once at startup.
 */
let io = null;

export const setIO = (server) => {
  io = server;
};

export const getIO = () => io;
