// 📌 개념 3: Node.js
// 이 파일은 브라우저가 아닌 Node.js 서버에서 실행됨
// Next.js가 pages/api/ 안의 파일을 자동으로 API 엔드포인트로 만들어줌

export default function handler(req, res) {
  // req.method: GET, POST 등 HTTP 메서드
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST만 허용' });
  }

  const { name, feeling } = req.body;

  if (!name || !feeling) {
    return res.status(400).json({ error: '이름과 오늘의 기분을 모두 입력해주세요.' });
  }

  // 서버(Node.js)에서 응답 생성
  const messages = {
    good:  `${name}님, 오늘 기분이 좋군요! 좋은 하루 보내세요 😊`,
    bad:   `${name}님, 힘내세요. 내일은 더 나을 거예요 💪`,
    meh:   `${name}님, 그럭저럭인 날도 있죠. 오늘도 수고했어요 👍`,
  };

  res.status(200).json({
    message: messages[feeling] ?? `${name}님, 안녕하세요!`,
    serverTime: new Date().toLocaleTimeString('ko-KR'), // Node.js에서 시간 계산
  });
}
