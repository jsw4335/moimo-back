import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✅ 연결 성공, ID:', socket.id);

  socket.emit('joinRoom', 1, (res) => {
    console.log('joinRoom 응답:', res);

    socket.emit(
      'sendMessage',
      { meetingId: 1, senderId: 1, content: '테스트 메시지' },
      (message) => {
        console.log('sendMessage 응답:', message);
      },
    );
  });
});

socket.on('connect_error', (err) => {
  console.error('❌ 연결 실패:', err.message);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 연결 끊김:', reason);
});

socket.on('newMessage', (msg) => {
  console.log('📩 새 메시지:', msg);
});
