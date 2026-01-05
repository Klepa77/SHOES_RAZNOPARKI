// admin.js - Админ-панель управления пользователями
console.log('Admin panel loading...');

// Конфигурация Firebase
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
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();

let currentAdmin = null;
let allUsers = [];
let activityLogs = [];

// Проверка прав администратора
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists && userDoc.data().role === 'admin') {
                currentAdmin = user;
                document.getElementById('totalUsers').textContent = '...';
                loadUsers();
                loadActivityLogs();
                setupRealtimeListeners();
            } else {
                showError('У вас нет прав доступа к админ-панели');
                setTimeout(() => window.location.href = 'index.html', 3000);
            }
        } catch (error) {
            console.error('Ошибка проверки прав:', error);
            showError('Ошибка проверки прав доступа');
        }
    } else {
        window.location.href = 'login.html';
    }
});

// Загрузка пользователей
async function loadUsers() {
    try {
        const usersSnapshot = await db.collection('users').get();
        allUsers = [];
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            allUsers.push({
                id: doc.id,
                ...userData
            });
        });

        updateUsersTable(allUsers);
        updateStats();
        
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        showError('Ошибка загрузки пользователей');
    }
}

// Обновление таблицы пользователей
function updateUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">Нет пользователей</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.email || 'N/A'}</td>
            <td>${user.fullName || 'N/A'}</td>
            <td>
                <span class="user-role ${user.role === 'admin' ? 'role-admin' : 'role-user'}">
                    ${user.role === 'admin' ? 'Админ' : 'Пользователь'}
                </span>
            </td>
            <td>
                <span class="user-status ${user.banned ? 'status-banned' : 'status-active'}">
                    ${user.banned ? 'Заблокирован' : 'Активен'}
                </span>
            </td>
            <td>${formatDate(user.lastLogin)}</td>
            <td>
                ${user.role !== 'admin' ? 
                    `<button class="action-btn btn-promote" onclick="promoteUser('${user.id}')">Сделать админом</button>` : 
                    `<button class="action-btn btn-demote" onclick="demoteUser('${user.id}')">Сделать пользователем</button>`
                }
                ${!user.banned ? 
                    `<button class="action-btn btn-ban" onclick="banUser('${user.id}')">Заблокировать</button>` : 
                    `<button class="action-btn btn-unban" onclick="unbanUser('${user.id}')">Разблокировать</button>`
                }
                ${user.id !== currentAdmin.uid ? 
                    `<button class="action-btn btn-delete" onclick="deleteUser('${user.id}')">Удалить</button>` : ''
                }
            </td>
        </tr>
    `).join('');
}

// Обновление статистики
function updateStats() {
    const totalUsers = allUsers.length;
    const adminUsers = allUsers.filter(u => u.role === 'admin').length;
    const bannedUsers = allUsers.filter(u => u.banned).length;
    
    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('adminUsers').textContent = adminUsers;
    document.getElementById('bannedUsers').textContent = bannedUsers;
    document.getElementById('activeUsers').textContent = totalUsers - bannedUsers;
}

// Управление пользователями
// ЗАМЕНИТЕ функции в admin.js:

window.promoteUser = async function(userId) {
    if (!confirm('Назначить пользователя администратором?')) return;
    
    try {
        // ПРОВЕРКА существования пользователя
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            showError('Пользователь не найден');
            return;
        }
        
        const userData = userDoc.data();
        
        // ПРОВЕРКА что пользователь не уже админ
        if (userData.role === 'admin') {
            showError('Пользователь уже является администратором');
            return;
        }
        
        // ОБНОВЛЕНИЕ с обработкой ошибок безопасности
        await db.collection('users').doc(userId).update({
            role: 'admin',
            lastModified: new Date().toISOString(),
            modifiedBy: currentAdmin.uid
        });
        
        // ОБНОВЛЕНИЕ локального состояния
        const userIndex = allUsers.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            allUsers[userIndex].role = 'admin';
            updateUsersTable(allUsers);
            updateStats();
        }
        
        // ЛОГИРОВАНИЕ действия
        await firestore.collection('admin_logs').add({
            action: 'promote_user',
            adminId: currentAdmin.uid,
            adminEmail: currentAdmin.email,
            targetUserId: userId,
            targetUserEmail: userData.email,
            timestamp: new Date().toISOString(),
            details: `Назначение прав администратора для ${userData.email}`
        });
        
        showMessage(`Пользователь ${userData.email} назначен администратором`, 'success');
        
    } catch (error) {
        console.error('❌ Ошибка назначения админа:', error);
        
        // ДЕТАЛЬНАЯ обработка ошибок Firebase
        let errorMessage = 'Ошибка назначения админа: ';
        switch (error.code) {
            case 'permission-denied':
                errorMessage = '❌ Недостаточно прав для изменения ролей пользователей';
                break;
            case 'not-found':
                errorMessage = '❌ Пользователь не найден в базе данных';
                break;
            case 'failed-precondition':
                errorMessage = '❌ Ошибка доступа к документу пользователя';
                break;
            default:
                errorMessage += error.message;
        }
        
        showError(errorMessage);
    }
};

// АНАЛОГИЧНО исправьте demoteUser, banUser, unbanUser
window.demoteUser = async function(userId) {
    if (!confirm('Снять права администратора?')) return;
    
    try {
        await db.collection('users').doc(userId).update({
            role: 'user'
        });
        showMessage('Права администратора сняты', 'success');
        loadUsers();
    } catch (error) {
        console.error('Ошибка снятия прав:', error);
        showError('Ошибка снятия прав');
    }
};

window.banUser = async function(userId) {
    if (!confirm('Заблокировать пользователя?')) return;
    
    try {
        await db.collection('users').doc(userId).update({
            banned: true
        });
        showMessage('Пользователь заблокирован', 'success');
        loadUsers();
    } catch (error) {
        console.error('Ошибка блокировки:', error);
        showError('Ошибка блокировки');
    }
};

window.unbanUser = async function(userId) {
    if (!confirm('Разблокировать пользователя?')) return;
    
    try {
        await db.collection('users').doc(userId).update({
            banned: false
        });
        showMessage('Пользователь разблокирован', 'success');
        loadUsers();
    } catch (error) {
        console.error('Ошибка разблокировки:', error);
        showError('Ошибка разблокировки');
    }
};

window.deleteUser = async function(userId) {
    if (!confirm('ВНИМАНИЕ: Это действие нельзя отменить! Удалить пользователя и все его данные?')) return;
    
    try {
        // Удаляем пользователя из Authentication
        // Note: Это требует дополнительных прав в Firebase - нужно настроить Cloud Functions
        await db.collection('users').doc(userId).delete();
        showMessage('Пользователь удален', 'success');
        loadUsers();
    } catch (error) {
        console.error('Ошибка удаления:', error);
        showError('Ошибка удаления пользователя');
    }
};

// Загрузка логов активности
async function loadActivityLogs() {
    try {
        const logsSnapshot = await db.collection('logs')
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();
        
        activityLogs = [];
        logsSnapshot.forEach(doc => {
            activityLogs.push({
                id: doc.id,
                ...doc.data()
            });
        });

        updateLogsTable();
        
    } catch (error) {
        console.error('Ошибка загрузки логов:', error);
    }
}

// Обновление таблицы логов
function updateLogsTable() {
    const tbody = document.getElementById('logsTableBody');
    
    if (activityLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666;">Нет данных логов</td></tr>';
        return;
    }

    tbody.innerHTML = activityLogs.map(log => `
        <tr>
            <td>${formatDateTime(log.timestamp)}</td>
            <td>${log.userEmail || 'N/A'}</td>
            <td>${log.role || 'N/A'}</td>
            <td>${log.action || 'N/A'}</td>
            <td>${log.details || ''}</td>
        </tr>
    `).join('');
}

// Вспомогательные функции
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('ru-RU');
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('ru-RU');
}

function switchTab(tabName) {
    // Скрыть все вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Показать выбранную вкладку
    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelector(`.tab[onclick="switchTab('${tabName}')"]`).classList.add('active');
}

function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const filteredUsers = allUsers.filter(user => 
        user.email?.toLowerCase().includes(searchTerm) ||
        user.fullName?.toLowerCase().includes(searchTerm)
    );
    updateUsersTable(filteredUsers);
}

function showMessage(message, type) {
    alert(`${type === 'success' ? '✅' : '❌'} ${message}`);
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.querySelector('.container').prepend(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Реальное время обновлений
function setupRealtimeListeners() {
    // Слушатель обновлений пользователей
    db.collection('users').onSnapshot((snapshot) => {
        loadUsers(); // Перезагружаем при изменениях
    });

    // Слушатель логов
    db.collection('logs').orderBy('timestamp', 'desc').limit(50)
        .onSnapshot((snapshot) => {
            loadActivityLogs();
        });
}

console.log('Admin panel loaded successfully');