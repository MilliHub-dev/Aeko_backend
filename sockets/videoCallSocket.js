export default function setupVideoCallSocket(io) {
  io.on('connection', (socket) => {
    socket.on('call-offer', (data) => {
      socket.to(data.target).emit('call-offer', { from: socket.id, offer: data.offer });
    });
    socket.on('call-answer', (data) => {
      socket.to(data.target).emit('call-answer', { from: socket.id, answer: data.answer });
    });
    socket.on('ice-candidate', (data) => {
      socket.to(data.target).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
    });
  });
}