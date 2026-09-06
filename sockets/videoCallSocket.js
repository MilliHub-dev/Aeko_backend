/**
 * WebRTC call signalling relay.
 *
 * Only `call-offer`, `call-answer` and `ice-candidate` used to be relayed. The
 * app also emits `call-ringing`, `call-rejected` and `call-ended`, and listens
 * for all three — with no handler here, those packets were dropped on the floor:
 *
 *   - the caller never left "connecting" (no ringing signal came back),
 *   - declining a call left the caller ringing until they gave up,
 *   - hanging up never told the other side, so both ends sat in a dead call.
 *
 * Every payload carries `target`, the recipient's socket id.
 */
export default function setupVideoCallSocket(io) {
  io.on('connection', (socket) => {
    const relay = (event, build) => {
      socket.on(event, (data = {}) => {
        if (!data.target) return;
        socket.to(data.target).emit(event, { from: socket.id, ...build(data) });
      });
    };

    relay('call-offer', (data) => ({ offer: data.offer }));
    relay('call-answer', (data) => ({ answer: data.answer }));
    relay('ice-candidate', (data) => ({ candidate: data.candidate }));

    // The three that were missing.
    relay('call-ringing', () => ({}));
    relay('call-rejected', () => ({}));
    relay('call-ended', (data) => ({ reason: data.reason }));
  });
}
