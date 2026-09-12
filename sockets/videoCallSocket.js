/**
 * WebRTC call signalling relay.
 *
 * Calls are addressed by USER id, not socket id.
 *
 * Addressing by socket id was the reason calls never connected: the app read a
 * peer's socket id out of a presence snapshot, and that id dies on every
 * reconnect — backgrounding the app, a network switch, the server waking up.
 * A stale id is not empty, so the old relay happily delivered the offer to a
 * room nobody was in: the callee never rang, never replied `call-ringing`, and
 * the caller sat on "Connecting…" until the 30s timeout.
 *
 * Every authenticated socket joins a room named after its user id (see
 * enhancedChatSocket.handleConnection), and that handler installs the auth
 * middleware on this same `io` instance — so `socket.userId` is already set
 * here, and `io.to(userId)` reaches the person on whatever socket they hold
 * now, including several devices at once.
 *
 * `target` (a raw socket id) is still accepted so calls keep working between an
 * app release and this deploy, but `targetUserId` is preferred.
 */
export default function setupVideoCallSocket(io) {
  io.on("connection", (socket) => {
    // Unauthenticated sockets cannot signal. Previously this handler trusted
    // whatever socket id a client supplied, so anyone connected could relay
    // call packets to any socket id they could guess.
    if (!socket.userId) return;

    const relay = (event, build) => {
      socket.on(event, (data = {}) => {
        const payload = {
          from: socket.id,
          fromUserId: socket.userId,
          ...build(data),
        };

        if (data.targetUserId) {
          // Deliver to every device that user currently has connected, minus
          // the sender's own sockets (calling yourself from a second device is
          // not a case worth routing).
          socket.broadcast.to(data.targetUserId).emit(event, payload);
          return;
        }

        // Legacy path: a raw socket id from an older client.
        if (data.target) {
          socket.to(data.target).emit(event, payload);
        }
      });
    };

    relay("call-offer", (data) => ({ offer: data.offer }));
    relay("call-answer", (data) => ({ answer: data.answer }));
    relay("ice-candidate", (data) => ({ candidate: data.candidate }));
    relay("call-ringing", () => ({}));
    relay("call-rejected", () => ({}));
    relay("call-ended", (data) => ({ reason: data.reason }));
  });
}
