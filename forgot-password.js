// forgot-password.js — СБРОС ПАРОЛЯ (ТОЛЬКО @ecco.com)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { getAuth, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyC4TJwaZIO3V1IoFgdb8VWkYiHhIV-xv2I",
  authDomain: "shoepairingapp.firebaseapp.com",
  projectId: "shoepairingapp",
  appId: "1:764417488769:web:3b2deb35fb227f2f315a80"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function showMessage(id, msg, type) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = msg;
    el.className = `msg ${type}`;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 8000);
  }
}

window.sendReset = async function() {
  const email = document.getElementById('email').value.trim().toLowerCase();
  const btn = document.querySelector('button');

  if (!email) {
    showMessage('error', 'Введите email', 'error');
    return;
  }

  if (!email.endsWith('@ecco.com')) {
    showMessage('error', 'Только корпоративная почта @ecco.com', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Отправка...';

  try {
    await sendPasswordResetEmail(auth, email);
    showMessage('success', `Ссылка отправлена на ${email}. Проверьте почту!`, 'success');
  } catch (error) {
    console.error('Ошибка сброса:', error);
    const msg = error.code === 'auth/user-not-found'
      ? 'Пользователь не найден. Проверьте email.'
      : error.code === 'auth/invalid-email'
      ? 'Неверный email.'
      : 'Ошибка: ' + error.message;
    showMessage('error', msg, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Отправить ссылку';
  }
};