import { io } from 'socket.io-client';

const socket2 = io('http://localhost:3000', {
  transports: ['websocket'],
});

socket2.on('connect', () => {
  console.log('✅ 두 번째 클라이언트 연결 성공, ID:', socket2.id);

  // 같은 meetingId 방에 입장
  socket2.emit('joinRoom', 1, (res) => {
    console.log('joinRoom 응답 (client2):', res);
  });
});

// 첫 번째 클라이언트가 메시지를 보내면 여기서 수신됨
socket2.on('newMessage', (msg) => {
  console.log('📩 client2가 받은 새 메시지:', msg);
});

socket2.on('connect_error', (err) => {
  console.error('❌ client2 연결 실패:', err.message);
});
