import { useState } from 'react';

export default function Home() {
  const [result, setResult] = useState(null);
  const [error, setError]   = useState(null);
  const [loading, setLoading] = useState(false);

  // 📌 개념 2: Promise (async/await)
  // form 제출 시 fetch로 API 라우트에 POST 요청
  async function handleSubmit(e) {
    e.preventDefault();
    setResult(null);
    setError(null);
    setLoading(true);

    const formData = new FormData(e.target);

    try {
      // fetch는 Promise를 반환 — await로 기다림
      const res = await fetch('/api/greet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    formData.get('name'),
          feeling: formData.get('feeling'),
        }),
      });

      // res.json()도 Promise 반환
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      <h1>세 가지 개념 통합 체험</h1>

      <section style={styles.card}>
        <h2>개념 흐름</h2>
        <p style={styles.flow}>
          📝 label + input (개념 1)
          → 제출 시 fetch/Promise (개념 2)
          → Node.js 서버가 응답 (개념 3)
        </p>
      </section>

      {/* 📌 개념 1: label + input */}
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.field}>
          {/* label의 for(htmlFor) ↔ input의 id 가 연결됨 */}
          <label htmlFor="name">이름</label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="이름을 입력하세요"
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label htmlFor="feeling">오늘의 기분</label>
          <select id="feeling" name="feeling" style={styles.input}>
            <option value="good">😊 좋음</option>
            <option value="meh">😐 그저 그럼</option>
            <option value="bad">😞 안 좋음</option>
          </select>
        </div>

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? '서버에 요청 중...' : '제출 (fetch → Node.js)'}
        </button>
      </form>

      {/* 결과 표시 */}
      {result && (
        <section style={{ ...styles.card, borderColor: '#2ecc71' }}>
          <p style={{ color: '#2ecc71', fontWeight: 'bold' }}>{result.message}</p>
          <p style={{ fontSize: '13px', color: '#888' }}>
            Node.js 서버 응답 시각: {result.serverTime}
          </p>
        </section>
      )}

      {error && (
        <section style={{ ...styles.card, borderColor: '#e74c3c' }}>
          <p style={{ color: '#e74c3c' }}>❌ {error}</p>
        </section>
      )}
    </main>
  );
}

const styles = {
  main:   { fontFamily: 'sans-serif', maxWidth: '520px', margin: '40px auto', padding: '0 20px' },
  card:   { border: '1px solid #ccc', borderRadius: '8px', padding: '16px', marginBottom: '20px' },
  flow:   { background: '#f0f0f0', padding: '10px', borderRadius: '6px', fontSize: '14px' },
  form:   { display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' },
  field:  { display: 'flex', flexDirection: 'column', gap: '6px' },
  input:  { padding: '8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '15px' },
  button: { padding: '10px', background: '#3498db', color: 'white', border: 'none',
            borderRadius: '6px', cursor: 'pointer', fontSize: '15px' },
};
