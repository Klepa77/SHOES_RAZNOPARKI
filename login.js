// login.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyC4TJwaZIO3V1IoFgdb8VWkYiHhIV-xv2I",
    authDomain: "shoepairingapp.firebaseapp.com",
    databaseURL: "https://shoepairingapp-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "shoepairingapp",
    storageBucket: "shoepairingapp.firebasestorage.app",
    messagingSenderId: "764417488769",
    appId: "1:764417488769:web:3b2deb35fb227f2f315a80",
    measurementId: "G-7Z67JT00JS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function showMessage(message, type = 'error') {
    const element = document.getElementById(type === 'error' ? 'error' : 'success');
    if (element) {
        element.textContent = message;
        element.className = `message ${type}`;
        element.style.display = 'block';
        setTimeout(() => { element.style.display = 'none'; }, 5000);
    }
    console.log(`${type.toUpperCase()}: ${message}`);
}

window.signIn = async function() {
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const loginBtn = document.getElementById('loginBtn');

    // Проверяем существование элементов
    if (!email || !password) {
        showMessage('Заполните email и пароль');
        return;
    }

    try {
        // Безопасно управляем кнопкой, если она существует
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Вход...';
        }

        console.log('Попытка входа для:', email);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        console.log('Вход успешен!');
        showMessage('Вход успешен! Перенаправление...', 'success');
        
        setTimeout(() => { 
            window.location.href = 'index.html'; 
        }, 2000);

    } catch (error) {
        console.error('signIn: Ошибка:', error);
        let errorMessage = 'Ошибка входа: ';
        
        switch (error.code) {
            case 'auth/wrong-password':
                errorMessage = 'Неверный пароль';
                break;
            case 'auth/user-not-found':
                errorMessage = 'Пользователь не найден';
                break;
            case 'auth/invalid-credential':
                errorMessage = 'Неверные учетные данные';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Слишком много попыток. Попробуйте позже';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Ошибка сети. Проверьте подключение к интернету';
                break;
            default:
                errorMessage += error.message;
        }
        
        showMessage(errorMessage);
    } finally {
        // Безопасно восстанавливаем кнопку
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Войти';
        }
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    console.log('Login page loaded');
    
    // Добавляем обработчик Enter
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                window.signIn();
            }
        });
    }
});