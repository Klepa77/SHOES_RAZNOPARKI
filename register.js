// register.js — АДАПТИРОВАННАЯ ВЕРСИЯ (ТОЛЬКО @ecco.com + ПЕРВЫЙ = ADMIN)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    sendEmailVerification 
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDocs, 
    collection, 
    query, 
    limit 
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

// Конфигурация Firebase (используем ту же, что в app.js)
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

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Функции уведомлений
function showMessage(id, msg, type) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = msg;
        el.className = `message ${type}`;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 5000);
    }
}

// Валидация силы пароля
function validatePasswordStrength(pwd) {
    if (!pwd) return false;
    
    const minLength = pwd.length >= 8;
    const hasLetters = /[a-zA-Z]/.test(pwd);
    const hasNumbers = /\d/.test(pwd);
    const strength = (minLength ? 1 : 0) + (hasLetters ? 1 : 0) + (hasNumbers ? 1 : 0);
    
    // Обновляем индикатор силы пароля
    const bar = document.getElementById('passwordStrength');
    if (bar) {
        bar.style.width = `${strength * 33.3}%`;
        bar.style.background = strength === 3 ? '#4CAF50' : 
                              strength === 2 ? '#FFC107' : '#F44336';
    }
    
    return strength === 3;
}

// Проверка формы
function checkForm() {
    const email = document.getElementById('email')?.value.trim() || '';
    const password = document.getElementById('password')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';
    const agreeTerms = document.getElementById('agreeTerms')?.checked || false;
    const btn = document.getElementById('registerBtn');
    
    if (!btn) return;
    
    // Проверяем условия
    const emailValid = email.endsWith('@ecco.com');
    const passwordValid = validatePasswordStrength(password);
    const passwordsMatch = password === confirmPassword && password.length > 0;
    const termsAccepted = agreeTerms;
    
    btn.disabled = !(emailValid && passwordValid && passwordsMatch && termsAccepted);
}

// Инициализация событий
function initEventListeners() {
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');
    const emailInput = document.getElementById('email');
    const termsCheckbox = document.getElementById('agreeTerms');
    
    if (passwordInput) {
        passwordInput.addEventListener('input', (e) => {
            validatePasswordStrength(e.target.value);
            checkForm();
        });
    }
    
    if (confirmInput) {
        confirmInput.addEventListener('input', checkForm);
    }
    
    if (emailInput) {
        emailInput.addEventListener('input', checkForm);
    }
    
    if (termsCheckbox) {
        termsCheckbox.addEventListener('change', checkForm);
    }
}

// Основная функция регистрации
window.register = async function() {
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const fullName = document.getElementById('fullName')?.value.trim() || email.split('@')[0];

    // === ПРОВЕРКА @ecco.com ===
    if (!email.endsWith('@ecco.com')) {
        showMessage('error', '❌ Используйте только корпоративную почту @ecco.com', 'error');
        return;
    }

    if (!email || !password) {
        showMessage('error', '❌ Заполните все обязательные поля', 'error');
        return;
    }

    const btn = document.getElementById('registerBtn');
    btn.disabled = true;
    btn.textContent = 'Регистрация...';

    try {
        console.log('🔐 Начинаем регистрацию для:', email);
        
        // 1. Создаём пользователя в Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('✅ Пользователь создан в Auth:', user.uid);

        // 2. Проверяем: первый ли пользователь?
        let isFirstUser = false;
        try {
            const usersQuery = query(collection(db, 'users'), limit(1));
            const usersSnapshot = await getDocs(usersQuery);
            isFirstUser = usersSnapshot.empty;
            console.log('👥 Проверка первого пользователя:', isFirstUser);
        } catch (err) {
            console.error('Ошибка проверки пользователей:', err);
            // Продолжаем, считая что это не первый пользователь
            isFirstUser = false;
        }

        const role = isFirstUser ? 'admin' : 'user';
        console.log('🎭 Назначена роль:', role);

        // 3. Сохраняем пользователя в Firestore
        const userData = {
            uid: user.uid,
            email: email,
            fullName: fullName,
            role: role,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', user.uid), userData);
        console.log('💾 Пользователь сохранен в Firestore');

        // 4. Отправляем email верификацию
        await sendEmailVerification(user);
        console.log('📧 Email верификация отправлена');

        // 5. Показываем успешное сообщение
        const successMessage = isFirstUser 
            ? `🎉 Вы первый пользователь! Роль: Администратор. Проверьте почту @ecco.com для верификации.` 
            : `✅ Регистрация успешна! Роль: Пользователь. Проверьте почту @ecco.com для верификации.`;
        
        showMessage('success', successMessage, 'success');

        // 6. Перенаправляем через 3 секунды
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);

    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
        
        let errorMessage = 'Ошибка регистрации: ';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = '📧 Этот email уже зарегистрирован';
                break;
            case 'auth/invalid-email':
                errorMessage = '❌ Неверный формат email';
                break;
            case 'auth/weak-password':
                errorMessage = '🔒 Слабый пароль. Используйте не менее 8 символов, включая буквы и цифры';
                break;
            case 'auth/network-request-failed':
                errorMessage = '🌐 Ошибка сети. Проверьте подключение к интернету';
                break;
            case 'permission-denied':
                errorMessage = '🚫 Ошибка доступа. Пожалуйста, сообщите администратору';
                break;
            default:
                errorMessage += error.message;
        }
        
        showMessage('error', errorMessage, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Зарегистрироваться';
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Register page initialized');
    initEventListeners();
    checkForm(); // Первоначальная проверка формы
});