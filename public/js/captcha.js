/**
 * ============================================================================
 *  captcha.js — загрузка и отображение математической капчи
 *  Используется на login.html и reg.html
 *  Сервер: GET /api/captcha, проверка в POST /login и /register
 * ============================================================================
 */

async function initCaptcha(containerId, tokenInputId, answerInputId) {
  const container = document.getElementById(containerId);
  const tokenInput = document.getElementById(tokenInputId);
  const answerInput = document.getElementById(answerInputId);
  if (!container || !tokenInput || !answerInput) return;

  async function loadCaptcha() {
    const res = await fetch('/api/captcha');
    const data = await res.json();
    tokenInput.value = data.token;
    container.innerHTML = `
      <div class="captcha-question">${data.question}</div>
      <button type="button" class="btn btn-secondary btn-sm" id="captcha-refresh">Другая задача</button>
    `;
    answerInput.value = '';
    document.getElementById('captcha-refresh')?.addEventListener('click', (e) => {
      e.preventDefault();
      loadCaptcha();
    });
  }

  await loadCaptcha();
}
