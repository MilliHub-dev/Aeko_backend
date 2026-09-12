/**
 * Group call signalling: a mesh, not a media server.
 *
 * Every participant holds a direct peer connection to every other participant,
 * so this server only ever relays signalling — it never touches media. That
 * keeps hosting cost at zero and reuses the WebRTC the app already ships, at
 * the price of scaling: each phone uploads its stream once per peer, so this
 * is sized for small calls (roughly four people).
 *
 * Addressing works the way videoCallSocket does: by USER id, never socket id.
 * Every authenticated socket joins a room named after its user id (see
 * enhancedChatSocket.handleConnection), and that handler installs the auth
 * middleware on this same `io`, so `socket.userId` is already set here. A
 * socket id goes stale on every reconnect; a user id does not.
 *
 * Call rooms are namespaced `gc:<roomId>` so they can never collide with the
 * per-user rooms or the chat rooms on the same server.
 */

const roomName = (roomId) => `gc:${roomId}`;

/** Which call rooms a socket has joined, so a disconnect can clean up. */
const joinedRooms = new WeakMap();

const roomsFor = (socket) => {
  let rooms = joinedRooms.get(socket);
  if (!rooms) {
    rooms = new Set();
    joinedRooms.set(socket, rooms);
  }
  return rooms;
};

/**
 * The distinct users currently in a call room, excluding one socket.
 *
 * Deduplicated by user id: someone signed in on two devices holds two sockets,
 * but they are one participant and must not appear twice in the grid.
 */
const peersInRoom = (io, room, exceptSocketId) => {
  const socketIds = io.sockets.adapter.rooms.get(room);
  if (!socketIds) return [];

  const byUserId = new Map();
  for (const socketId of socketIds) {
    if (socketId === exceptSocketId) continue;
    const peer = io.sockets.sockets.get(socketId);
    if (!peer?.userId || byUserId.has(peer.userId)) continue;
    byUserId.set(peer.userId, {
      userId: peer.userId,
      socketId: peer.id,
      name: peer.user?.name ?? null,
      username: peer.user?.username ?? null,
      avatar: peer.user?.profilePicture ?? peer.user?.avatar ?? null,
    });
  }
  return [...byUserId.values()];
};

export default function setupGroupCallSocket(io) {
  io.on("connection", (socket) => {
    // Unauthenticated sockets cannot signal: without this, anyone connected
    // could relay into any room id they could guess.
    if (!socket.userId) return;

    /**
     * Join a call room and learn who is already there.
     *
     * The joiner receives the existing peers and is responsible for offering
     * to each of them. Everyone already in the room only answers. That one
     * rule is what prevents offer glare in a mesh — without it two peers
     * offer each other simultaneously and both connections fail.
     */
    socket.on("group-call:join", (data = {}) => {
      const { roomId } = data;
      if (!roomId) return;

      const room = roomName(roomId);
      const peers = peersInRoom(io, room, socket.id);

      socket.join(room);
      roomsFor(socket).add(room);

      socket.emit("group-call:peers", { roomId, peers });

      socket.broadcast.to(room).emit("group-call:peer_joined", {
        roomId,
        userId: socket.userId,
        socketId: socket.id,
        name: socket.user?.name ?? null,
        username: socket.user?.username ?? null,
        avatar: socket.user?.profilePicture ?? socket.user?.avatar ?? null,
      });
    });

    /**
     * Relay one signalling packet (offer, answer or ICE candidate) to a single
     * participant. The payload is passed through untouched — the server has no
     * business inspecting SDP — but the sender is stamped by the server so it
     * cannot be forged.
     */
    socket.on("group-call:signal", (data = {}) => {
      const { roomId, targetUserId, signal } = data;
      if (!roomId || !targetUserId || !signal) return;

      // Sent to the target's personal room, so it reaches whatever socket they
      // hold now, on any device.
      socket.broadcast.to(targetUserId).emit("group-call:signal", {
        roomId,
        fromUserId: socket.userId,
        from: socket.id,
        signal,
      });
    });

    /**
     * Invite people to a call room. Used both to start a group call and to add
     * someone to a call already in progress.
     */
    socket.on("group-call:invite", (data = {}) => {
      const { roomId, targetUserIds, callType, conversationId } = data;
      if (!roomId || !Array.isArray(targetUserIds)) return;

      for (const targetUserId of targetUserIds) {
        if (!targetUserId || targetUserId === socket.userId) continue;
        socket.broadcast.to(targetUserId).emit("group-call:incoming", {
          roomId,
          callType: callType === "video" ? "video" : "audio",
          conversationId: conversationId ?? null,
          fromUserId: socket.userId,
          fromName: socket.user?.name ?? null,
          fromAvatar: socket.user?.profilePicture ?? socket.user?.avatar ?? null,
        });
      }
    });

    /** Declining an invitation, so the inviter can stop waiting. */
    socket.on("group-call:decline", (data = {}) => {
      const { roomId, targetUserId } = data;
      if (!roomId || !targetUserId) return;
      socket.broadcast.to(targetUserId).emit("group-call:declined", {
        roomId,
        fromUserId: socket.userId,
      });
    });

    const leaveRoom = (room, roomId) => {
      socket.leave(room);
      roomsFor(socket).delete(room);
      socket.broadcast.to(room).emit("group-call:peer_left", {
        roomId,
        userId: socket.userId,
        socketId: socket.id,
      });
    };

    socket.on("group-call:leave", (data = {}) => {
      const { roomId } = data;
      if (!roomId) return;
      leaveRoom(roomName(roomId), roomId);
    });

    // A dropped connection must not leave a ghost tile in everyone's grid.
    socket.on("disconnect", () => {
      for (const room of roomsFor(socket)) {
        socket.broadcast.to(room).emit("group-call:peer_left", {
          roomId: room.startsWith("gc:") ? room.slice(3) : room,
          userId: socket.userId,
          socketId: socket.id,
        });
      }
      joinedRooms.delete(socket);
    });
  });
}
