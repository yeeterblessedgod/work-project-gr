/**
 * ============================================================================
 *  auth.js — клиентская логика login.html и reg.html
 *  - Капча (captcha.js)
 *  - Кнопка «Войти как гость» → POST /guest
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Капча на странице входа
  if (document.getElementById('captcha-container')) {
    initCaptcha('captcha-container', 'captcha_token', 'captcha_answer');
  }

  // Капча на странице регистрации
  if (document.getElementById('captcha-container-reg')) {
    initCaptcha('captcha-container-reg', 'captcha_token_reg', 'captcha_answer_reg');
  }

  // Сообщение после успешной регистрации
  const params = new URLSearchParams(window.location.search);
  if (params.get('registered') === '1') {
    const box = document.getElementById('register-success');
    if (box) box.classList.remove('hidden');
  }

  // Кнопка «Войти как гость»
  const guestBtn = document.getElementById('guest-login-btn');
  if (guestBtn) {
    guestBtn.addEventListener('click', () => {
      const form = document.getElementById('guest-form');
      if (form) form.submit();
    });
  }
});
