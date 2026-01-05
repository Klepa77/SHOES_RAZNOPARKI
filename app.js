// app.js - ВЕРСИЯ 8.0 (ПОЛНАЯ ПЕРЕЗАПИСЬ С ИСПРАВЛЕНИЯМИ)
console.log("App.js loaded - VERSION 8.0 - Complete fixes for pairing and synchronization");

// ========== КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ ==========
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
const db = firebase.database();
const firestore = firebase.firestore();

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let shoesData = [];
let pairedList = [];
let displayedIndexes = [];
let lastEditedIndex = -1;
let highlightTimeout;
let originalDataStore = {};

// Счетчики только для текущей сессии
let sessionAddedCount = 0;
let sessionDeletedCount = 0;
let initialCount = 0;
let pairedCount = 0;

let userRole = null;
let user = null;
let isOnline = navigator.onLine;
let firebaseListeners = [];
let userActivity = new Map();

// Ключ для блокировки одновременных операций
let isSyncing = false;

// ========== СИСТЕМНЫЕ ФУНКЦИИ ==========
function checkInternet() {
  return navigator.onLine;
}

window.showNotification = function(message, type = 'success') {
  const notification = document.getElementById('exportNotification');
  if (notification) {
    notification.textContent = message;
    notification.className = `notification ${type} visible`;
    setTimeout(() => notification.classList.remove('visible'), 3000);
  }
  console.log(`${type.toUpperCase()}: ${message}`);
};

function updateOnlineStatus() {
  isOnline = checkInternet();
  const onlineStatus = document.getElementById('onlineStatus');
  if (onlineStatus) {
    if (isOnline) {
      onlineStatus.innerHTML = '🟢 Онлайн';
      onlineStatus.className = 'online-status online';
    } else {
      onlineStatus.innerHTML = '🔴 Оффлайн';
      onlineStatus.className = 'online-status offline';
    }
  }
}

async function logAction(action, details) {
  if (!user) return;
  try {
    await firestore.collection('logs').add({
      userId: user.uid,
      role: userRole,
      action,
      timestamp: new Date().toISOString(),
      details,
      userEmail: user.email
    });
  } catch (error) {
    console.error('logAction:', error);
  }
}

// Быстрое обновление данных и синхронизация
async function quickDataUpdate() {
  try {
    // 1. Обновляем пары (пересчитываем)
    window.pairShoes();
    
    // 2. Немедленная синхронизация с Firebase
    await syncToFirebase();
    
    // 3. Быстрое обновление интерфейса (счетчики и т.д.)
    window.updateCounters();
    window.saveToLocalStorage();
    
  } catch (error) {
    console.error('❌ Ошибка быстрого обновления:', error);
    throw error;
  }
}

// Периодическая проверка валидности данных
function startDataHealthCheck() {
  setInterval(() => {
    console.log('🔍 Проверка здоровья данных...');
    
    // Проверяем валидность всех пар
    const invalidPairs = pairedList.filter(pair => 
      pair.i >= shoesData.length || pair.j >= shoesData.length
    );
    
    if (invalidPairs.length > 0) {
      console.warn(`⚠️ Найдены невалидные пары: ${invalidPairs.length}`);
      
      // Автоматически исправляем
      pairedList = pairedList.filter(pair => 
        pair.i < shoesData.length && pair.j < shoesData.length
      );
      
      // Если были изменения, обновляем интерфейс и синхронизируем
      if (invalidPairs.length > 0) {
        window.renderPairedTable(pairedList);
        window.updateCounters();
        window.saveToLocalStorage();
        
        // Синхронизируем с Firebase, если онлайн
        if (isOnline) {
          syncToFirebase().catch(error => {
            console.error('Ошибка синхронизации после очистки невалидных пар:', error);
          });
        }
        
        console.log(`✅ Невалидные пары автоматически удалены`);
      }
    }
  }, 30000); // Проверка каждые 30 секунд
}

// ========== АУТЕНТИФИКАЦИЯ И ПОЛЬЗОВАТЕЛИ ==========
async function createUserInFirestore(user) {
  try {
    const userDoc = await firestore.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      console.log('Создаем нового пользователя в Firestore:', user.email);
      
      const usersSnapshot = await firestore.collection('users').get();
      const isFirstUser = usersSnapshot.empty;
      
      const newUser = {
        email: user.email,
        fullName: user.displayName || user.email.split('@')[0],
        role: isFirstUser ? 'admin' : 'user',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        banned: false
      };
      
      await firestore.collection('users').doc(user.uid).set(newUser);
      console.log('Пользователь создан в Firestore, роль:', newUser.role);
      return newUser;
    } else {
      const userData = userDoc.data();
      if (userData.banned) {
        throw new Error('Аккаунт заблокирован');
      }
      
      await firestore.collection('users').doc(user.uid).update({
        lastLogin: new Date().toISOString()
      });
      return userData;
    }
  } catch (error) {
    console.error('Ошибка создания пользователя в Firestore:', error);
    throw error;
  }
}

function updateUserPermissions() {
  const exportShoesBtn = document.getElementById('exportShoesBtn');
  const exportPairedBtn = document.getElementById('exportPairedBtn');
  const uploadBtn = document.getElementById('uploadBtn');
  
  if (userRole === 'user') {
    if (exportShoesBtn) exportShoesBtn.disabled = true;
    if (exportPairedBtn) exportPairedBtn.disabled = true;
    if (uploadBtn) uploadBtn.disabled = true;
    
    const adminBtn = document.querySelector('.admin-btn, .admin-icon-btn');
    if (adminBtn) adminBtn.style.display = 'none';
  } else {
    if (exportShoesBtn) exportShoesBtn.disabled = false;
    if (exportPairedBtn) exportPairedBtn.disabled = false;
    if (uploadBtn) uploadBtn.disabled = false;
    
    const adminBtn = document.querySelector('.admin-btn, .admin-icon-btn');
    if (adminBtn) adminBtn.style.display = 'block';
  }
}

function checkUserPermissions() {
  if (!user) {
    window.showNotification('Ошибка: Не авторизован', 'error');
    return false;
  }
  if (userRole === 'user') {
    window.showNotification('Ошибка: Недостаточно прав', 'error');
    return false;
  }
  return true;
}

// ========== СИНХРОНИЗАЦИЯ ДАННЫХ ==========
async function replaceLocalData(data) {
  console.log('🔄 Замена локальных данных на данные из Firebase');

  if (!data.shoes) {
    shoesData = [];
    pairedList = [];
  } else {
    const firebaseShoes = Object.values(data.shoes);
    
    shoesData = firebaseShoes.map(row => [
      String(row.article || ''),
      String(row.color || ''),
      String(row.size || ''),
      String(row.leftSize || ''),
      String(row.rightSize || ''),
      String(row.pallet || ''),
      String(row.timestamp || new Date().toISOString()),
      String(row.addedBy || ''),
      String(row.lastModified || new Date().toISOString())
    ]);

    // ВАЖНО: Игнорируем пары из Firebase и пересчитываем заново
    pairedList = [];
    console.log('🔄 Игнорируем пары из Firebase, пересчитываем заново...');
  }

  // Сбрасываем счетчики сессии
  initialCount = shoesData.length;
  sessionAddedCount = 0;
  sessionDeletedCount = 0;

  displayedIndexes = shoesData.map((_, idx) => idx);
  
  window.renderShoesTable();
  
  // ПЕРЕСЧИТЫВАЕМ ПАРЫ ЗАНОВО
  window.pairShoes();
  
  window.updateCounters();
  window.saveToLocalStorage();

  console.log(`✅ Данные заменены: ${shoesData.length} записей, ${pairedList.length} пар (пересчитано)`);
}

async function syncToFirebase() {
  if (!user || !isOnline || isSyncing) {
    console.log('❌ Синхронизация отключена');
    return;
  }
  
  isSyncing = true;
  
  try {
    console.log('💾 Начинаем синхронизацию с Firebase...');
    
    // ФИЛЬТРАЦИЯ ПАР ПЕРЕД ОТПРАВКОЙ
    const validPairedList = pairedList.filter(pair => {
      const validIndexes = pair.i < shoesData.length && pair.j < shoesData.length;
      if (!validIndexes) {
        console.warn(`❌ Удалена невалидная пара при синхронизации: (${pair.i}, ${pair.j})`);
        return false;
      }
      
      // Дополнительная проверка на корректность пары
      const row1 = shoesData[pair.i];
      const row2 = shoesData[pair.j];
      const normalizeArticle = (art) => String(art || '').trim().replace(/\s*[Dd]\s*$/, '');
      
      const art1 = normalizeArticle(row1[0]);
      const art2 = normalizeArticle(row2[0]);
      const color1 = String(row1[1] || '').trim();
      const color2 = String(row2[1] || '').trim();
      
      const validPair = (art1 === art2 && color1 === color2);
      if (!validPair) {
        console.warn(`❌ Удалена некорректная пара при синхронизации: разные артикулы/цветы`);
      }
      
      return validIndexes && validPair && pair.count > 0;
    });

    const shoesUpdates = {};
    shoesData.forEach((row, index) => {
      shoesUpdates[`shoe_${index}`] = {
        article: String(row[0] || ''),
        color: String(row[1] || ''),
        size: String(row[2] || ''),
        leftSize: String(row[3] || ''),
        rightSize: String(row[4] || ''),
        pallet: String(row[5] || ''),
        timestamp: String(row[6] || new Date().toISOString()),
        addedBy: String(row[7] || user.uid),
        lastModified: new Date().toISOString(),
        userRole: userRole,
        userEmail: user.email
      };
    });
    
    const allData = {
      shoes: shoesUpdates,
      pairs: validPairedList, // ← ТОЛЬКО ВАЛИДНЫЕ ПАРЫ
      lastModified: new Date().toISOString(),
      modifiedBy: user.email,
      totalRecords: shoesData.length,
      pairedRecords: validPairedList.length
    };
    
    await db.ref('shared_data').set(allData);
    console.log(`✅ Данные синхронизированы: ${shoesData.length} записей, ${validPairedList.length} пар`);
    
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error);
    window.showNotification('Ошибка синхронизации с общей базой', 'error');
    throw error;
  } finally {
    isSyncing = false;
  }
}

async function loadInitialData() {
  if (!user) return;
  
  console.log('📥 Загрузка начальных данных из Firebase...');
  
  try {
    const snapshot = await db.ref('shared_data').once('value');
    const sharedData = snapshot.val();
    
    if (sharedData) {
      await replaceLocalData(sharedData);
      console.log('✅ Начальные данные загружены из Firebase');
    } else {
      shoesData = [];
      pairedList = [];
      initialCount = 0;
      sessionAddedCount = 0;
      sessionDeletedCount = 0;
      pairedCount = 0;
      
      window.renderShoesTable();
      window.renderPairedTable(pairedList);
      window.updateCounters();
      console.log('💡 В Firebase нет данных, инициализированы пустые');
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки начальных данных:', error);
    window.showNotification('Ошибка загрузки данных', 'error');
  }
}

// ========== СЛУШАТЕЛИ РЕАЛЬНОГО ВРЕМЕНИ ==========
function setupRealtimeListeners() {
  if (!user) return;
  
  console.log('🔔 Настройка слушателей реального времени');
  
  firebaseListeners.forEach(unsubscribe => unsubscribe());
  firebaseListeners = [];

  // Слушатель общих данных
  const dataRef = db.ref('shared_data');
  const dataListener = dataRef.on('value', async (snapshot) => {
    const data = snapshot.val();
    console.log('📡 Получены обновления из общей базы');
    
    if (data && !isSyncing) {
      await replaceLocalData(data);
    }
  });
  
  firebaseListeners.push(() => dataRef.off('value', dataListener));

  // Слушатель активности пользователей
  const activityRef = db.ref('user_activity');
  const activityListener = activityRef.on('value', (snapshot) => {
    const activityData = snapshot.val();
    updateUserActivityDisplay(activityData);
  });
  firebaseListeners.push(() => activityRef.off('value', activityListener));

  // Слушатель сканирования
  const scansRef = db.ref('scans');
  const scansListener = scansRef.on('child_added', (snapshot) => {
    const scanData = snapshot.val();
    if (scanData && scanData.userId === user.uid) {
      processScannerData(scanData, snapshot.key);
    }
  });
  firebaseListeners.push(() => scansRef.off('child_added', scansListener));
  
  console.log('✅ Слушатели настроены');
}

function updateUserActivityDisplay(activityData) {
  if (!activityData) return;
  userActivity.clear();
  Object.keys(activityData).forEach(userId => {
    const activity = activityData[userId];
    if (activity.userId !== user.uid) {
      userActivity.set(userId, activity);
      if (activity.editingIndex !== undefined && activity.editingIndex !== -1) {
        const tableRow = document.querySelector(`#shoesTable tbody tr[data-index="${activity.editingIndex}"]`);
        if (tableRow) {
          tableRow.classList.add('editing-by-other');
          tableRow.title = `Редактируется: ${activity.userEmail}`;
        }
      }
    }
  });
}

async function sendUserActivity(editingIndex = -1) {
  if (!user || !isOnline) return;
  try {
    await db.ref(`user_activity/${user.uid}`).set({
      userId: user.uid,
      userEmail: user.email,
      editingIndex: editingIndex,
      lastActivity: new Date().toISOString()
    });
  } catch (error) {
    console.error('Ошибка отправки активности:', error);
  }
}

window.markRowAsEditing = function(sourceIndex, isEditing = true) {
  if (!user) return;
  const tableRow = document.querySelector(`#shoesTable tbody tr[data-index="${sourceIndex}"]`);
  if (tableRow) {
    if (isEditing) {
      tableRow.classList.add('editing-by-user');
      tableRow.title = `Редактируете вы`;
    } else {
      tableRow.classList.remove('editing-by-user');
      tableRow.title = '';
    }
  }
};

// ========== ОБРАБОТКА СКАНЕРА ==========
async function processScannerData(scanData, scanKey) {
  try {
    const newRow = [
      String(scanData.article || ''),
      String(scanData.color || ''),
      String(scanData.size || ''),
      String(scanData.leftSize || ''),
      String(scanData.rightSize || ''),
      String(scanData.pallet || ''),
      String(scanData.timestamp || new Date().toISOString()),
      user.uid,
      new Date().toISOString()
    ];

    // УБРАНА ПРОВЕРКА НА ДУБЛИКАТЫ - разрешаем сканеру добавлять одинаковые записи
    shoesData.push(newRow);
    sessionAddedCount++;
    displayedIndexes = shoesData.map((_, idx) => idx);
    window.renderShoesTable();

    // Используем быструю синхронизацию
    await quickDataUpdate();

    try {
      await db.ref(`scans/${scanKey}`).remove();
      window.showNotification('Новые данные от сканера добавлены в общую базу!', 'success');
      await logAction('scanner_add', `Добавлено через сканер: ${scanData.article}`);
    } catch (error) {
      console.error('Ошибка синхронизации сканера:', error);
      window.showNotification('Данные сканера сохранены локально', 'warning');
    }
  } catch (error) {
    console.error('processScannerData: Ошибка:', error);
  }
}

// ========== ВАЛИДАЦИЯ ==========
window.validateSizeFormat = function(value) {
  return !value || /^\d{2}$/.test(value) || /^\d{2}\/\d{2}$/.test(value);
};

window.validateForm = function() {
  const fields = {
    article: { id: "article", required: true, validate: (v) => /^\d{6}( D)?$/.test(v.trim()) },
    color: { id: "color", required: true, validate: (v) => v.trim().length === 5 && /^\d+$/.test(v) },
    size: { id: "size", required: true, validate: (v) => v.trim().length === 2 && /^\d+$/.test(v) },
    leftSize: { id: "leftSize", required: false, validate: (v) => window.validateSizeFormat(v) },
    rightSize: { id: "rightSize", required: false, validate: (v) => window.validateSizeFormat(v) },
    pallet: { id: "pallet", required: true, validate: (v) => v.trim().length > 0 }
  };

  let isValid = true;
  Object.values(fields).forEach(field => {
    const input = document.getElementById(field.id);
    if (!input) {
      console.error(`validateForm: Элемент ${field.id} не найден`);
      isValid = false;
      return;
    }
    const value = input.value.trim();
    input.classList.remove('error', 'valid');
    if (field.required && !value) {
      input.classList.add('error');
      isValid = false;
    } else if (value && !field.validate(value)) {
      input.classList.add('error');
      isValid = false;
    } else if (value) {
      input.classList.add('valid');
    }
  });
  return isValid;
};

// ========== ОСНОВНЫЕ ОПЕРАЦИИ ==========
window.addShoe = async function() {
  if (!user) {
    window.showNotification('Ошибка: Не авторизован', 'error');
    return;
  }
  
  if (window.validateForm()) {
    const formData = {
      article: document.getElementById("article").value.trim(),
      color: document.getElementById("color").value.trim(),
      size: document.getElementById("size").value.trim(),
      leftSize: document.getElementById("leftSize").value.trim(),
      rightSize: document.getElementById("rightSize").value.trim(),
      pallet: document.getElementById("pallet").value.trim()
    };

    const newRow = [
      formData.article,
      formData.color,
      formData.size,
      formData.leftSize,
      formData.rightSize,
      formData.pallet,
      new Date().toISOString(),
      user.uid,
      new Date().toISOString()
    ];

    // УБРАНА ПРОВЕРКА НА ДУБЛИКАТЫ - разрешаем добавлять одинаковые записи
    shoesData.push(newRow);
    sessionAddedCount++;
    displayedIndexes = shoesData.map((_, idx) => idx);
    window.renderShoesTable();

    // Очистка формы
    Object.keys(formData).forEach(fieldName => {
      const element = document.getElementById(fieldName);
      if (element) {
        element.value = "";
        element.classList.remove('error', 'valid');
      }
    });

    // Используем быструю синхронизацию вместо отдельных вызовов
    await quickDataUpdate();

    try {
      window.showNotification('Обувь добавлена в общую систему!', 'success');
      await logAction('add_shoe', `Добавлена обувь: ${formData.article}`);
    } catch (error) {
      console.error('Ошибка синхронизации:', error);
      window.showNotification('Обувь добавлена локально (ошибка синхронизации)', 'warning');
    }
  } else {
    window.showNotification('Исправьте ошибки в форме', 'error');
  }
};

// ========== РЕДАКТИРОВАНИЕ ==========
window.editRow = function(sourceIndex) {
  if (!checkUserPermissions()) return;
  if (sourceIndex < 0 || sourceIndex >= shoesData.length) return;
  
  const row = shoesData[sourceIndex];
  const tableRow = document.querySelector(`#shoesTable tbody tr[data-index="${sourceIndex}"]`);
  if (!tableRow) return;

  window.markRowAsEditing(sourceIndex, true);
  sendUserActivity(sourceIndex);
  originalDataStore[sourceIndex] = [...row];
  
  const cells = tableRow.getElementsByTagName('td');
  for (let i = 0; i < 6; i++) {
    cells[i].innerHTML = `<input type="text" value="${row[i] || ''}" class="edit-input" data-index="${i}">`;
  }
  
  const actionButtons = tableRow.querySelector('.action-buttons');
  if (actionButtons) {
    actionButtons.innerHTML = `
      <button class="action-btn save-btn" onclick="window.saveEdit(${sourceIndex})">Сохранить</button>
      <button class="action-btn" onclick="window.cancelEdit(${sourceIndex})">Отмена</button>
      <button class="action-btn delete-btn" onclick="window.showDeleteModal(${sourceIndex})">Удалить</button>
    `;
  }
  
  const inputs = tableRow.getElementsByTagName('input');
  const fields = {
    0: (v) => /^\d{6}( D)?$/.test(v.trim()),
    1: (v) => v.trim().length === 5 && /^\d+$/.test(v),
    2: (v) => v.trim().length === 2 && /^\d+$/.test(v),
    3: (v) => !v || window.validateSizeFormat(v),
    4: (v) => !v || window.validateSizeFormat(v),
    5: (v) => v.trim().length > 0
  };
  
  Array.from(inputs).forEach(input => {
    const i = parseInt(input.dataset.index);
    input.oninput = () => input.style.border = fields[i](input.value.trim()) ? '2px solid green' : '2px solid red';
    input.style.border = fields[i](input.value.trim()) ? '2px solid green' : '1px solid #ccc';
  });
  
  tableRow.classList.add('edited-row');
};

window.saveEdit = async function(sourceIndex) {
  if (!checkUserPermissions()) return;
  
  const tableRow = document.querySelector(`#shoesTable tbody tr[data-index="${sourceIndex}"]`);
  if (!tableRow) return;
  
  const inputs = tableRow.getElementsByTagName('input');
  const newRow = Array.from(inputs).map(input => input.value.trim() || '');
  
  let isValid = true;
  const fields = {
    0: (v) => /^\d{6}( D)?$/.test(v.trim()),
    1: (v) => v.trim().length === 5 && /^\d+$/.test(v),
    2: (v) => v.trim().length === 2 && /^\d+$/.test(v),
    3: (v) => !v || window.validateSizeFormat(v),
    4: (v) => !v || window.validateSizeFormat(v),
    5: (v) => v.trim().length > 0
  };
  
  Array.from(inputs).forEach((input, i) => {
    if (!fields[i](input.value.trim())) {
      input.style.border = '2px solid red';
      isValid = false;
    } else {
      input.style.border = '2px solid green';
    }
  });
  
  if (isValid) {
    shoesData[sourceIndex] = [...newRow.slice(0, 6), shoesData[sourceIndex][6], user.uid, new Date().toISOString()];
    
    if (highlightTimeout) clearTimeout(highlightTimeout);
    lastEditedIndex = sourceIndex;
    window.renderShoesTable();
    highlightTimeout = setTimeout(() => {
      lastEditedIndex = -1;
      window.renderShoesTable();
    }, 3000);
    
    delete originalDataStore[sourceIndex];
    
    // Используем быструю синхронизацию
    await quickDataUpdate();
    
    window.markRowAsEditing(sourceIndex, false);
    sendUserActivity(-1);
    window.showNotification('Изменения сохранены!', 'success');
    
    try {
      await logAction('edit_shoe', `Отредактирована запись: ${newRow[0]}`);
    } catch (error) {
      console.error('Ошибка синхронизации:', error);
    }
  } else {
    window.showNotification('Исправьте ошибки в форме', 'error');
  }
};

window.cancelEdit = function(sourceIndex) {
  if (sourceIndex < 0 || !originalDataStore[sourceIndex]) return;
  
  shoesData[sourceIndex] = [...originalDataStore[sourceIndex]];
  delete originalDataStore[sourceIndex];
  window.renderShoesTable();
  window.saveToLocalStorage();
  
  window.markRowAsEditing(sourceIndex, false);
  sendUserActivity(-1);
  window.showNotification('Редактирование отменено', 'info');
};

// ========== УДАЛЕНИЕ ==========
window.showDeleteModal = function(sourceIndex) {
  if (!checkUserPermissions()) return;
  
  if (sourceIndex < 0 || sourceIndex >= shoesData.length) {
    window.showNotification('Ошибка: Некорректная строка', 'error');
    return;
  }

  const modal = document.getElementById('deleteModal');
  const modalRowInfo = document.getElementById('modalRowInfo');
  if (!modal || !modalRowInfo) return;
  
  const row = shoesData[sourceIndex];
  const article = row[0] || 'Без артикула';
  const color = row[1] || 'Без цвета';
  const size = row[2] || 'Без размера';
  const pallet = row[5] || 'Без паллета';
  
  modalRowInfo.textContent = `Вы уверены, что хотите удалить строку?\nАртикул: ${article}, Цвет: ${color}, Размер: ${size}, Паллет: ${pallet}`;
  modal.style.display = 'flex';
  
  const confirmDelete = document.getElementById('confirmDelete');
  const cancelDelete = document.getElementById('cancelDelete');
  
  confirmDelete.onclick = null;
  cancelDelete.onclick = null;
  
  const confirmHandler = () => {
    modal.style.display = 'none';
    window.deleteRowConfirmed(sourceIndex);
    confirmDelete.onclick = null;
    cancelDelete.onclick = null;
  };
  
  const cancelHandler = () => {
    modal.style.display = 'none';
    confirmDelete.onclick = null;
    cancelDelete.onclick = null;
  };
  
  confirmDelete.onclick = confirmHandler;
  cancelDelete.onclick = cancelHandler;
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      confirmDelete.onclick = null;
      cancelDelete.onclick = null;
    }
  };
};

window.deleteRowConfirmed = async function(sourceIndex) {
  if (!checkUserPermissions()) return;
  
  if (sourceIndex < 0 || sourceIndex >= shoesData.length) {
    window.showNotification('Ошибка: Некорректная строка', 'error');
    return;
  }

  const removedRow = shoesData.splice(sourceIndex, 1)[0];
  sessionDeletedCount++;

  pairedList = pairedList.filter(pair => 
    pair.i !== sourceIndex && pair.j !== sourceIndex
  );

  pairedList = pairedList.map(pair => {
    let newI = pair.i;
    let newJ = pair.j;
    if (pair.i > sourceIndex) newI--;
    if (pair.j > sourceIndex) newJ--;
    return { ...pair, i: newI, j: newJ };
  });

  displayedIndexes = shoesData.map((_, idx) => idx);
  window.renderShoesTable();
  window.renderPairedTable(pairedList);

  // Используем быструю синхронизацию
  await quickDataUpdate();

  try {
    window.showNotification(`Строка удалена: ${removedRow[0] || 'Без артикула'}`, 'success');
    await logAction('delete_shoe', `Удалена запись: ${removedRow[0]}`);
  } catch (error) {
    console.error('Ошибка синхронизации удаления:', error);
    window.showNotification(`Строка удалена локально (ошибка синхронизации)`, 'warning');
  }
};

window.deletePair = async function(i, j) {
  if (!checkUserPermissions()) return;
  
  if (i < 0 || i >= shoesData.length || j < 0 || j >= shoesData.length) {
    window.showNotification('Ошибка: Пара не найдена', 'error');
    return;
  }

  // Получаем артикулы ДО удаления
  const article1 = shoesData[i][0] || 'Без артикула';
  const article2 = shoesData[j][0] || 'Без артикула';

  // 1. Удаляем пару из спаренного списка
  pairedList = pairedList.filter(pair => 
    !((pair.i === i && pair.j === j) || (pair.i === j && pair.j === i))
  );

  // 2. Удаляем записи из основной таблицы
  const indicesToRemove = [];
  if (i === j) {
    indicesToRemove.push(i);
  } else {
    indicesToRemove.push(i, j);
  }

  // Убираем дубликаты индексов
  const uniqueIndices = [...new Set(indicesToRemove)];
  uniqueIndices.sort((a, b) => b - a);
  
  uniqueIndices.forEach(idx => {
    if (idx < shoesData.length) {
      shoesData.splice(idx, 1);
      sessionDeletedCount++;
    }
  });

  // 3. Обновляем индексы в оставшихся парах
  pairedList = pairedList.map(pair => {
    let newI = pair.i;
    let newJ = pair.j;
    uniqueIndices.forEach(removedIdx => {
      if (pair.i > removedIdx) newI--;
      if (pair.j > removedIdx) newJ--;
    });
    return { ...pair, i: newI, j: newJ };
  });

  // 4. Фильтруем невалидные пары
  pairedList = pairedList.filter(pair => 
    pair.i < shoesData.length && pair.j < shoesData.length
  );

  // 5. Полное обновление интерфейса
  displayedIndexes = shoesData.map((_, idx) => idx);

  // Используем быструю синхронизацию
  await quickDataUpdate();

  try {
    window.showNotification(`Пара полностью удалена: ${article1}, ${article2}`, 'success');
    await logAction('delete_pair', `Полностью удалена пара: ${article1}, ${article2}`);
  } catch (error) {
    console.error('Ошибка синхронизации удаления:', error);
    window.showNotification(`Пара удалена локально (ошибка синхронизации)`, 'warning');
  }
};

// ========== УЛУЧШЕННОЕ СПАРИВАНИЕ ==========
// window.pairShoes = function() {
//   if (!shoesData || shoesData.length === 0) {
//     pairedList = [];
//     pairedCount = 0;
//     window.renderPairedTable(pairedList);
//     window.updateCounters();
//     window.saveToLocalStorage();
//     return;
//   }

//   const newPairedList = [];
//   let totalPairsFound = 0;

//   function parseSizes(sizeStr) {
//     if (!sizeStr) return [];
//     return sizeStr.split('/')
//       .map(s => s.trim())
//       .filter(Boolean)
//       .map(s => parseInt(s))
//       .filter(n => !isNaN(n) && n > 0);
//   }

//   function calculateActualPairs(leftSizes1, rightSizes1, leftSizes2, rightSizes2, isSameRow = false) {
//     let pairsFound = 0;
    
//     if (isSameRow) {
//       const leftCounts = {};
//       const rightCounts = {};
      
//       leftSizes1.forEach(size => {
//         leftCounts[size] = (leftCounts[size] || 0) + 1;
//       });
      
//       rightSizes1.forEach(size => {
//         rightCounts[size] = (rightCounts[size] || 0) + 1;
//       });

//       for (const size in leftCounts) {
//         if (rightCounts[size]) {
//           pairsFound += Math.min(leftCounts[size], rightCounts[size]);
//         }
//       }
//     } else {
//       const left1Counts = {};
//       const right1Counts = {};
//       const left2Counts = {};
//       const right2Counts = {};

//       leftSizes1.forEach(size => left1Counts[size] = (left1Counts[size] || 0) + 1);
//       rightSizes1.forEach(size => right1Counts[size] = (right1Counts[size] || 0) + 1);
//       leftSizes2.forEach(size => left2Counts[size] = (left2Counts[size] || 0) + 1);
//       rightSizes2.forEach(size => right2Counts[size] = (right2Counts[size] || 0) + 1);

//       for (const size in left1Counts) {
//         if (right2Counts[size]) {
//           pairsFound += Math.min(left1Counts[size], right2Counts[size]);
//         }
//       }
      
//       for (const size in right1Counts) {
//         if (left2Counts[size]) {
//           pairsFound += Math.min(right1Counts[size], left2Counts[size]);
//         }
//       }
//     }
    
//     return pairsFound;
//   }

//   // НОРМАЛИЗАЦИЯ АРТИКУЛА - убираем D/d в конце
//   function normalizeArticle(article) {
//     return String(article || '').trim().replace(/\s*[Dd]\s*$/, '');
//   }

//   const groups = new Map();
  
//   shoesData.forEach((row, idx) => {
//     const art = String(row[0] || '').trim();
//     const normalizedArt = normalizeArticle(art);
//     const color = String(row[1] || '').trim();
//     const key = `${normalizedArt}_${color}`;
    
//     if (!groups.has(key)) {
//       groups.set(key, []);
//     }
    
//     groups.get(key).push({
//       idx,
//       originalArt: art,
//       leftSizes: parseSizes(row[3]),
//       rightSizes: parseSizes(row[4]),
//       used: false
//     });
//   });

//   groups.forEach((group) => {
//     if (group.length === 0) return;

//     group.forEach(item => {
//       if (item.used) return;
      
//       const selfPairs = calculateActualPairs(
//         item.leftSizes,
//         item.rightSizes,
//         item.leftSizes,
//         item.rightSizes,
//         true
//       );
      
//       if (selfPairs > 0) {
//         newPairedList.push({
//           i: item.idx,
//           j: item.idx,
//           count: selfPairs,
//           type: 'self'
//         });
//         totalPairsFound += selfPairs;
//         item.used = true;
//       }
//     });

//     for (let i = 0; i < group.length; i++) {
//       const current = group[i];
//       if (current.used) continue;
      
//       for (let j = i + 1; j < group.length; j++) {
//         const candidate = group[j];
//         if (candidate.used) continue;
        
//         const crossPairs = calculateActualPairs(
//           current.leftSizes,
//           current.rightSizes,
//           candidate.leftSizes,
//           candidate.rightSizes,
//           false
//         );
        
//         if (crossPairs > 0) {
//           newPairedList.push({
//             i: current.idx,
//             j: candidate.idx,
//             count: crossPairs,
//             type: 'cross'
//           });
//           totalPairsFound += crossPairs;
//           current.used = true;
//           candidate.used = true;
//           break;
//         }
//       }
//     }
//   });

//   // ЗАМЕНЯЕМ весь pairedList на новый
//   pairedList = newPairedList.filter(pair => 
//     pair.i < shoesData.length && 
//     pair.j < shoesData.length &&
//     pair.count > 0
//   );

//   // Убираем дубликаты
//   const pairMap = new Map();
//   pairedList.forEach(pair => {
//     const key = `${Math.min(pair.i, pair.j)}-${Math.max(pair.i, pair.j)}`;
//     if (!pairMap.has(key)) {
//       pairMap.set(key, pair);
//     }
//   });
  
//   pairedList = Array.from(pairMap.values());
//   pairedCount = pairedList.reduce((sum, pair) => sum + (pair.count || 1), 0);

//   // УЛУЧШЕННАЯ СОРТИРОВКА СПАРЕННЫХ ПАР
//   pairedList.sort((a, b) => {
//     const artA = shoesData[a.i][0] || '';
//     const artB = shoesData[b.i][0] || '';
//     const numA = parseInt(artA.replace(/\D/g, '')) || 0;
//     const numB = parseInt(artB.replace(/\D/g, '')) || 0;
//     return numA !== numB ? numA - numB : artA.localeCompare(artB);
//   });

//   console.log(`✅ Спаривание завершено: найдено ${pairedList.length} пар`);
// };
// ========== УЛУЧШЕННОЕ СПАРИВАНИЕ ==========
window.pairShoes = function() {
  if (!shoesData || shoesData.length === 0) {
    pairedList = [];
    pairedCount = 0;
    window.renderPairedTable(pairedList);
    window.updateCounters();
    window.saveToLocalStorage();
    return;
  }

  console.log('🔄 Начинаем спаривание...');
  
  // ПОЛНОСТЬЮ ОЧИЩАЕМ список пар и пересчитываем заново
  const newPairedList = [];

  function parseSizes(sizeStr) {
    if (!sizeStr) return [];
    return sizeStr.split('/')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => parseInt(s))
      .filter(n => !isNaN(n) && n > 0);
  }

  function calculateActualPairs(leftSizes1, rightSizes1, leftSizes2, rightSizes2, isSameRow = false) {
    let pairsFound = 0;
    
    if (isSameRow) {
      const leftCounts = {};
      const rightCounts = {};
      
      leftSizes1.forEach(size => {
        leftCounts[size] = (leftCounts[size] || 0) + 1;
      });
      
      rightSizes1.forEach(size => {
        rightCounts[size] = (rightCounts[size] || 0) + 1;
      });

      for (const size in leftCounts) {
        if (rightCounts[size]) {
          pairsFound += Math.min(leftCounts[size], rightCounts[size]);
        }
      }
    } else {
      const left1Counts = {};
      const right1Counts = {};
      const left2Counts = {};
      const right2Counts = {};

      leftSizes1.forEach(size => left1Counts[size] = (left1Counts[size] || 0) + 1);
      rightSizes1.forEach(size => right1Counts[size] = (right1Counts[size] || 0) + 1);
      leftSizes2.forEach(size => left2Counts[size] = (left2Counts[size] || 0) + 1);
      rightSizes2.forEach(size => right2Counts[size] = (right2Counts[size] || 0) + 1);

      for (const size in left1Counts) {
        if (right2Counts[size]) {
          pairsFound += Math.min(left1Counts[size], right2Counts[size]);
        }
      }
      
      for (const size in right1Counts) {
        if (left2Counts[size]) {
          pairsFound += Math.min(right1Counts[size], left2Counts[size]);
        }
      }
    }
    
    return pairsFound;
  }

  // НОРМАЛИЗАЦИЯ АРТИКУЛА - убираем D/d в конце
  function normalizeArticle(article) {
    return String(article || '').trim().replace(/\s*[Dd]\s*$/, '');
  }

  const groups = new Map();
  
  // Группируем по нормализованному артикулу и цвету
  shoesData.forEach((row, idx) => {
    const art = String(row[0] || '').trim();
    const normalizedArt = normalizeArticle(art);
    const color = String(row[1] || '').trim();
    const key = `${normalizedArt}_${color}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    
    groups.get(key).push({
      idx,
      originalArt: art,
      leftSizes: parseSizes(row[3]),
      rightSizes: parseSizes(row[4]),
      used: false
    });
  });

  console.log(`📊 Найдено групп для спаривания: ${groups.size}`);

  // Поиск пар в каждой группе
  groups.forEach((group, groupKey) => {
    if (group.length === 0) return;

    // Сначала ищем само-спаривание (внутри одной записи)
    group.forEach(item => {
      if (item.used) return;
      
      const selfPairs = calculateActualPairs(
        item.leftSizes,
        item.rightSizes,
        item.leftSizes,
        item.rightSizes,
        true
      );
      
      if (selfPairs > 0) {
        newPairedList.push({
          i: item.idx,
          j: item.idx,
          count: selfPairs,
          type: 'self',
          groupKey: groupKey
        });
        item.used = true;
        console.log(`✅ Само-спаривание: индекс ${item.idx}, пар: ${selfPairs}`);
      }
    });

    // Затем ищем кросс-спаривание (между разными записями)
    for (let i = 0; i < group.length; i++) {
      const current = group[i];
      if (current.used) continue;
      
      for (let j = i + 1; j < group.length; j++) {
        const candidate = group[j];
        if (candidate.used) continue;
        
        const crossPairs = calculateActualPairs(
          current.leftSizes,
          current.rightSizes,
          candidate.leftSizes,
          candidate.rightSizes,
          false
        );
        
        if (crossPairs > 0) {
          newPairedList.push({
            i: current.idx,
            j: candidate.idx,
            count: crossPairs,
            type: 'cross',
            groupKey: groupKey
          });
          current.used = true;
          candidate.used = true;
          console.log(`✅ Кросс-спаривание: индексы ${current.idx} и ${candidate.idx}, пар: ${crossPairs}`);
          break;
        }
      }
    }
  });

  // ЗАМЕНЯЕМ весь pairedList на новый (только валидные пары)
  pairedList = newPairedList.filter(pair => {
    const isValid = pair.i < shoesData.length && pair.j < shoesData.length && pair.count > 0;
    if (!isValid) {
      console.warn(`❌ Удалена невалидная пара: (${pair.i}, ${pair.j})`);
    }
    return isValid;
  });

  // Убираем дубликаты
  const pairMap = new Map();
  pairedList.forEach(pair => {
    const key = `${Math.min(pair.i, pair.j)}-${Math.max(pair.i, pair.j)}`;
    if (!pairMap.has(key)) {
      pairMap.set(key, pair);
    }
  });
  
  pairedList = Array.from(pairMap.values());
  pairedCount = pairedList.reduce((sum, pair) => sum + (pair.count || 1), 0);

  // УЛУЧШЕННАЯ СОРТИРОВКА
  pairedList.sort((a, b) => {
    const artA = shoesData[a.i][0] || '';
    const artB = shoesData[b.i][0] || '';
    const numA = parseInt(artA.replace(/\D/g, '')) || 0;
    const numB = parseInt(artB.replace(/\D/g, '')) || 0;
    return numA !== numB ? numA - numB : artA.localeCompare(artB);
  });

  console.log(`✅ Спаривание завершено: найдено ${pairedList.length} пар, всего ${pairedCount} единиц`);
  
  window.renderPairedTable(pairedList);
  window.updateCounters();
  window.saveToLocalStorage();
};

// ========== РЕНДЕРИНГ ТАБЛИЦ ==========
window.renderShoesTable = function() {
  const tableBody = document.getElementById('shoesTable')?.getElementsByTagName('tbody')[0];
  if (!tableBody) {
    console.error('renderShoesTable: Таблица shoesTable не найдена');
    return;
  }

  console.log(`🔄 Рендеринг таблицы: ${shoesData.length} строк`);
  
  tableBody.innerHTML = '';

  if (shoesData.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: #666; padding: 20px;">
          Нет данных. Добавьте первую запись.
        </td>
      </tr>
    `;
    return;
  }

  const sortedIndexes = [...displayedIndexes].sort((a, b) => {
    const artA = shoesData[a][0] || '';
    const artB = shoesData[b][0] || '';
    const numA = parseInt(artA.replace(/\D/g, '')) || 0;
    const numB = parseInt(artB.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  const indexesToRender = sortedIndexes.length > 0 ? 
    sortedIndexes.filter(idx => idx < shoesData.length) : 
    shoesData.map((_, idx) => idx);

  indexesToRender.forEach(sourceIndex => {
    const row = shoesData[sourceIndex];
    const tr = document.createElement('tr');
    tr.setAttribute('data-index', sourceIndex);
    
    tr.innerHTML = `
      <td>${row[0] || ''}</td>
      <td>${row[1] || ''}</td>
      <td>${row[2] || ''}</td>
      <td>${row[3] || ''}</td>
      <td>${row[4] || ''}</td>
      <td>${row[5] || ''}</td>
    `;

    const imgCell = document.createElement('td');
    const imgSrc = window.getImgSrc(row);
    if (imgSrc) {
      imgCell.innerHTML = `<img class="shoes-img" src="${imgSrc}" loading="lazy" width="32" height="32" alt="${imgSrc.includes('730') ? 'Два башмака' : 'Один башмак'}">`;
    } else {
      imgCell.textContent = 'Нет данных';
    }
    tr.appendChild(imgCell);

    const actionCell = document.createElement('td');
    const editDisabled = userRole === 'user' ? 'disabled' : '';
    const deleteDisabled = userRole === 'user' ? 'disabled' : '';
    
    actionCell.innerHTML = `
      <div class="action-buttons">
        <button class="action-btn edit-btn" onclick="window.editRow(${sourceIndex})" ${editDisabled}>Редактировать</button>
        <button class="action-btn save-btn" style="display:none;" onclick="window.saveEdit(${sourceIndex})">Сохранить</button>
        <button class="action-btn" style="display:none;" onclick="window.cancelEdit(${sourceIndex})">Отмена</button>
        <button class="action-btn delete-btn" onclick="window.showDeleteModal(${sourceIndex})" ${deleteDisabled}>Удалить</button>
      </div>
    `;
    tr.appendChild(actionCell);

    if (sourceIndex === lastEditedIndex) {
      tr.classList.add('edited-row');
    }
    
    tableBody.appendChild(tr);
  });
};

window.renderPairedTable = function(pairedList) {
  const tableBody = document.getElementById('pairedTable')?.getElementsByTagName('tbody')[0];
  if (!tableBody) {
    console.error('renderPairedTable: Таблица pairedTable не найдена');
    return;
  }

  tableBody.innerHTML = '';

  const validPairs = pairedList.filter(pair => {
    const isValid = pair.i < shoesData.length && pair.j < shoesData.length;
    if (!isValid) {
      console.warn('Некорректная пара удалена:', pair);
    }
    return isValid;
  });

  // СОРТИРОВКА ПАР ПО АРТИКУЛУ (от меньшего к большему)
  validPairs.sort((a, b) => {
    const artA = shoesData[a.i][0] || '';
    const artB = shoesData[b.i][0] || '';
    const numA = parseInt(artA.replace(/\D/g, '')) || 0;
    const numB = parseInt(artB.replace(/\D/g, '')) || 0;
    return numA !== numB ? numA - numB : artA.localeCompare(artB);
  });

  validPairs.forEach((pair) => {
    const { i, j, type, count } = pair;
    
    if (i >= shoesData.length || j >= shoesData.length) {
      console.error(`Некорректные индексы пары: i=${i}, j=${j}, длина shoesData=${shoesData.length}`);
      return;
    }

    const row1 = shoesData[i];
    const row2 = shoesData[j];

    const tr1 = document.createElement('tr');
    tr1.style.backgroundColor = '#d4edda';
    tr1.innerHTML = `
      <td>${row1[0] || ''}</td>
      <td>${row1[1] || ''}</td>
      <td>${row1[2] || ''}</td>
      <td>${row1[3] || ''}</td>
      <td>${row1[4] || ''}</td>
      <td>${row1[5] || ''}</td>
      <td>Спарено (${count || 1})</td>
      <td>${type}</td>
    `;

    const actionCell1 = document.createElement('td');
    const deleteDisabled = userRole === 'user' ? 'disabled' : '';
    actionCell1.innerHTML = `<button class="action-btn delete-btn" onclick="window.deletePair(${i}, ${j})" ${deleteDisabled}>Удалить пару</button>`;
    tr1.appendChild(actionCell1);

    const imgCell1 = document.createElement('td');
    const imgSrc1 = window.getImgSrc(row1);
    if (imgSrc1) {
      imgCell1.innerHTML = `<img class="shoes-img" src="${imgSrc1}" loading="lazy" width="32" height="32" alt="${imgSrc1.includes('730') ? 'Два башмака' : 'Один башмак'}">`;
    } else {
      imgCell1.textContent = 'Нет данных';
    }
    tr1.appendChild(imgCell1);

    tableBody.appendChild(tr1);

    if (i !== j) {
      const tr2 = document.createElement('tr');
      tr2.style.backgroundColor = '#d4edda';
      tr2.innerHTML = `
        <td>${row2[0] || ''}</td>
        <td>${row2[1] || ''}</td>
        <td>${row2[2] || ''}</td>
        <td>${row2[3] || ''}</td>
        <td>${row2[4] || ''}</td>
        <td>${row2[5] || ''}</td>
        <td>Спарено (${count || 1})</td>
        <td>${type}</td>
      `;

      const actionCell2 = document.createElement('td');
      actionCell2.innerHTML = `<button class="action-btn delete-btn" onclick="window.deletePair(${i}, ${j})" ${deleteDisabled}>Удалить пару</button>`;
      tr2.appendChild(actionCell2);

      const imgCell2 = document.createElement('td');
      const imgSrc2 = window.getImgSrc(row2);
      if (imgSrc2) {
        imgCell2.innerHTML = `<img class="shoes-img" src="${imgSrc2}" loading="lazy" width="32" height="32" alt="${imgSrc2.includes('730') ? 'Два башмака' : 'Один башмак'}">`;
      } else {
        imgCell2.textContent = 'Нет данных';
      }
      tr2.appendChild(imgCell2);

      tableBody.appendChild(tr2);
    }
  });
};

window.getImgSrc = function(row) {
  const leftPp = row[3] || '';
  const rightPp = row[4] || '';
  const hasSlash = leftPp.includes('/') || rightPp.includes('/');
  const bothFilled = leftPp && rightPp;
  const oneFilled = (leftPp && !rightPp) || (!leftPp && rightPp);

  if (hasSlash || bothFilled) {
    return './images/730.png';
  } else if (oneFilled && !hasSlash) {
    return './images/731.png';
  } else {
    return '';
  }
};

// ========== СИСТЕМА СЧЕТЧИКОВ ==========
window.updateCounters = function() {
  const loadedCount = document.getElementById('loadedCount');
  const addedCountEl = document.getElementById('addedCount');
  const deletedCountEl = document.getElementById('deletedCount');
  const pairedCountEl = document.getElementById('pairedCount');
  const totalCountEl = document.getElementById('totalCount');

  pairedCount = pairedList.reduce((sum, pair) => sum + (pair.count || 1), 0);

  if (loadedCount) loadedCount.textContent = initialCount;
  if (addedCountEl) addedCountEl.textContent = sessionAddedCount;
  if (deletedCountEl) deletedCountEl.textContent = sessionDeletedCount;
  if (pairedCountEl) pairedCountEl.textContent = pairedCount;
  if (totalCountEl) totalCountEl.textContent = shoesData.length;

  console.log(`📊 Счетчики: Исходные=${initialCount}, Добавлено=${sessionAddedCount}, Удалено=${sessionDeletedCount}, Пар=${pairedCount}, Всего=${shoesData.length}`);
};

window.saveToLocalStorage = function() {
  try {
    const data = {
      shoesData,
      pairedList,
      counters: {
        initialCount,
        sessionAddedCount,
        sessionDeletedCount,
        pairedCount
      },
      lastUpdate: Date.now()
    };
    localStorage.setItem('eccoShoesData', JSON.stringify(data));
  } catch (error) {
    console.error('saveToLocalStorage: Ошибка:', error);
  }
};

window.loadFromLocalStorage = function() {
  try {
    const storedData = JSON.parse(localStorage.getItem('eccoShoesData') || '{}');
    if (storedData.shoesData) {
      shoesData = storedData.shoesData;
      pairedList = storedData.pairedList || [];
      pairedList = pairedList.filter(pair => pair.i < shoesData.length && pair.j < shoesData.length);
      
      initialCount = storedData.counters?.initialCount || shoesData.length;
      sessionAddedCount = storedData.counters?.sessionAddedCount || 0;
      sessionDeletedCount = storedData.counters?.sessionDeletedCount || 0;
      pairedCount = pairedList.reduce((sum, pair) => sum + (pair.count || 1), 0);
      
      displayedIndexes = shoesData.map((_, idx) => idx);
      window.renderShoesTable();
      window.renderPairedTable(pairedList);
      window.updateCounters();
      
      console.log(`📁 Локальные данные загружены: ${shoesData.length} записей`);
    }
  } catch (error) {
    console.error('loadFromLocalStorage: Ошибка:', error);
  }
};

// ========== ФИЛЬТРАЦИЯ ==========

window.filterTable = function() {
  const filterInput = document.getElementById('filterInput');
  const filterBtn = document.getElementById('filterBtn');
  const palletCount = document.getElementById('palletCount');
  
  if (!filterInput || !filterBtn || !palletCount) {
    window.showNotification('Ошибка: Элементы фильтрации не найдены', 'error');
    return;
  }
  
  palletCount.textContent = '';
  palletCount.classList.remove('visible');
  filterBtn.disabled = true;
  filterBtn.textContent = 'Фильтрация...';
  
  const valueToFilter = filterInput.value.trim().toLowerCase();
  
  if (!valueToFilter) {
    displayedIndexes = shoesData.map((_, idx) => idx);
    window.renderShoesTable();
    filterBtn.disabled = false;
    filterBtn.textContent = 'Фильтровать';
    window.showNotification('Введите значение для фильтрации', 'warning');
    return;
  }
  
  let filteredIndexes = [];
  const isPalletFilter = valueToFilter.startsWith('паллет:') || valueToFilter.startsWith('pallet:');
  const isArticleFilter = /^\d{6}/.test(valueToFilter) || valueToFilter.includes('d') || valueToFilter.includes('д');
  
  if (isArticleFilter) {
    const filterParts = valueToFilter.split(/\s+/);
    const artInput = filterParts[0].startsWith('=') ? filterParts[0].slice(1) : filterParts[0];
    const isExactMatch = filterParts[0].startsWith('=');
    const colorInput = filterParts[1] || '';
    const sizeInput = filterParts[2] || '';
    
    const seen = new Set();
    shoesData.forEach((row, sourceIndex) => {
      const safeToString = (val) => String(val || '').toLowerCase().trim().replace(/\s+/g, '');
      const art = safeToString(row[0]);
      const color = safeToString(row[1]);
      const size = safeToString(row[2]);
      const leftSize = safeToString(row[3]);
      const rightSize = safeToString(row[4]);
      const pallet = safeToString(row[5]);
      
      let match = false;
      if (artInput) {
        const normalizedArt = art.replace(/\s*(d|д)\s*$/i, '');
        const normalizedInput = artInput.replace(/\s*(d|д)\s*$/i, '');
        match = isExactMatch ? (normalizedArt === normalizedInput) : (normalizedArt.includes(normalizedInput));
        
        if (artInput.toLowerCase().endsWith('d') || artInput.toLowerCase().endsWith('д')) {
          match = match || art.includes('d') || art.includes('д');
        }
      }
      
      if (match && colorInput && color !== colorInput) match = false;
      if (match && sizeInput) {
        const normalizeSize = (s) => s.replace(/[^0-9]/g, '').split('/')[0];
        match = normalizeSize(size) === sizeInput || normalizeSize(leftSize) === sizeInput || normalizeSize(rightSize) === sizeInput;
      }
      
      if (match && !seen.has(row.join('|'))) {
        filteredIndexes.push(sourceIndex);
        seen.add(row.join('|'));
      }
    });
  } else if (isPalletFilter) {
    const pallets = valueToFilter.split(/\s+/).flatMap(part => {
      if (part.startsWith('паллет:')) {
        return part.slice(7).split(',').map(p => p.trim());
      } else if (part.startsWith('pallet:')) {
        return part.slice(7).split(',').map(p => p.trim());
      }
      return [];
    }).filter(p => p.length > 0);
    
    filteredIndexes = shoesData
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => {
        const pallet = String(row[5] || '').toLowerCase().trim();
        return pallets.some(p => pallet === p || pallet.includes(p));
      })
      .map(({ idx }) => idx);
    
    const recordCount = filteredIndexes.length;
    
    // РАСЧЕТ КОЛИЧЕСТВА ПАР НА ПАЛЛЕТЕ
    let pairCount = 0;
    const palletPairs = pairedList.filter(pair => {
      const row1 = shoesData[pair.i];
      const row2 = shoesData[pair.j];
      const pallet1 = String(row1[5] || '').toLowerCase().trim();
      const pallet2 = String(row2[5] || '').toLowerCase().trim();
      
      return pallets.some(p => pallet1 === p || pallet1.includes(p) || pallet2 === p || pallet2.includes(p));
    });
    
    pairCount = palletPairs.reduce((sum, pair) => sum + (pair.count || 1), 0);
    
    if (pallets.length > 0) {
      palletCount.innerHTML = `
        <strong>Статистика по паллет${pallets.length > 1 ? 'ам' : 'у'} ${pallets.join(', ')}:</strong><br>
        - Записей: ${recordCount}<br>
        - Спаренных пар: ${pairCount}
      `;
      palletCount.classList.add('visible');
    }
    
    if (recordCount === 0) {
      window.showNotification(`Записи для паллет ${pallets.join(', ')} не найдены`, 'warning');
    } else {
      window.showNotification(`Найдено ${recordCount} записей и ${pairCount} пар на паллет${pallets.length > 1 ? 'ах' : 'е'} ${pallets.join(', ')}`, 'success');
    }
  } else if (/^\d+$/.test(valueToFilter)) {
    filteredIndexes = shoesData
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => {
        const pallet = String(row[5] || '').toLowerCase().trim();
        return pallet === valueToFilter || pallet.includes(valueToFilter);
      })
      .map(({ idx }) => idx);
    
    const recordCount = filteredIndexes.length;
    
    // РАСЧЕТ КОЛИЧЕСТВА ПАР НА ПАЛЛЕТЕ
    let pairCount = 0;
    const palletPairs = pairedList.filter(pair => {
      const row1 = shoesData[pair.i];
      const row2 = shoesData[pair.j];
      const pallet1 = String(row1[5] || '').toLowerCase().trim();
      const pallet2 = String(row2[5] || '').toLowerCase().trim();
      
      return pallet1 === valueToFilter || pallet1.includes(valueToFilter) || 
             pallet2 === valueToFilter || pallet2.includes(valueToFilter);
    });
    
    pairCount = palletPairs.reduce((sum, pair) => sum + (pair.count || 1), 0);
    
    palletCount.innerHTML = `
      <strong>Статистика по паллету ${valueToFilter}:</strong><br>
      - Записей: ${recordCount}<br>
      - Спаренных пар: ${pairCount}
    `;
    palletCount.classList.add('visible');
    
    if (recordCount === 0) {
      window.showNotification(`Записи для паллета ${valueToFilter} не найдены`, 'warning');
    } else {
      window.showNotification(`Найдено ${recordCount} записей и ${pairCount} пар на паллете ${valueToFilter}`, 'success');
    }
  } else {
    filteredIndexes = shoesData
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => {
        return row.some(cell => String(cell || '').toLowerCase().includes(valueToFilter));
      })
      .map(({ idx }) => idx);
  }
  
  displayedIndexes = filteredIndexes;
  window.renderShoesTable();
  
  setTimeout(() => {
    filterBtn.disabled = false;
    filterBtn.textContent = 'Фильтровать';
  }, 500);
};
// ========== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ==========
window.openStatsPage = function() {
  window.location.href = 'stats.html';
};

window.openAdminPanel = function() {
  if (userRole === 'admin') {
    window.location.href = 'admin.html';
  } else {
    window.showNotification('Недостаточно прав для доступа к админ-панели', 'error');
  }
};

window.exportToExcel = async function() {
  if (!user) {
    window.showNotification('Ошибка: Не авторизован', 'error');
    return;
  }
  
  if (userRole === 'user') {
    window.showNotification('Ошибка: Недостаточно прав для экспорта', 'error');
    return;
  }
  
  try {
    if (!isOnline) {
      window.showNotification('Ошибка экспорта: Нет интернета', 'error');
      return;
    }
    
    if (!window.XLSX) {
      window.showNotification('Ошибка экспорта: Библиотека XLSX не загружена', 'error');
      return;
    }
    
    if (shoesData.length === 0) {
      window.showNotification('Ошибка экспорта: Нет данных', 'error');
      return;
    }
    
    const wb = XLSX.utils.book_new();
    const shoesWs = XLSX.utils.aoa_to_sheet([
      ['Артикул', 'Цвет', 'Размер', 'Левый_размер', 'Правый_размер', 'Паллет'],
      ...shoesData.map(row => row.slice(0, 6))
    ]);
    
    const pairedData = [];
    pairedList.forEach(pair => {
      const row1 = shoesData[pair.i];
      const row2 = shoesData[pair.j];
      pairedData.push([
        row1[0], row1[1], row1[2], row1[3], row1[4], row1[5],
        'Спарено', pair.type, `Количество: ${pair.count || 1}`
      ]);
      
      if (pair.i !== pair.j) {
        pairedData.push([
          row2[0], row2[1], row2[2], row2[3], row2[4], row2[5],
          'Спарено', pair.type, `Количество: ${pair.count || 1}`
        ]);
      }
    });
    
    const pairedWs = XLSX.utils.aoa_to_sheet([
      ['Артикул', 'Цвет', 'Размер', 'Левый размер', 'Правый размер', 'Паллет', 'Статус', 'Тип пары', 'Количество'],
      ...pairedData
    ]);
    
    XLSX.utils.book_append_sheet(wb, shoesWs, 'Исходные данные');
    XLSX.utils.book_append_sheet(wb, pairedWs, 'Спаренные пары');
    
    const fileName = `ecco_shoes_data_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName, { bookType: 'xlsx', compression: true });
    
    window.showNotification('Файл успешно экспортирован!', 'success');
    await logAction('export_excel', 'Экспорт данных в Excel');
  } catch (error) {
    console.error('exportToExcel: Ошибка:', error);
    window.showNotification('Ошибка экспорта в Excel: ' + error.message, 'error');
  }
};

window.handleExcelUpload = async function() {
  if (!user) {
    window.showNotification('Ошибка: Не авторизован', 'error');
    return;
  }
  
  if (userRole === 'user') {
    window.showNotification('Ошибка: Недостаточно прав для загрузки Excel', 'error');
    return;
  }

  const fileInput = document.getElementById('excelInput');
  const file = fileInput?.files[0];
  
  if (!file) {
    window.showNotification('Ошибка: Выберите файл', 'error');
    return;
  }

  const validMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  
  if (!validMimeTypes.includes(file.type)) {
    window.showNotification('Ошибка: Файл должен быть в формате XLSX или XLS', 'error');
    return;
  }

  try {
    window.showNotification('Начинаем обработку файла...', 'info');
    
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(new Uint8Array(e.target.result));
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsArrayBuffer(file);
    });

    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const newData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (newData.length < 2) {
      window.showNotification('Файл пустой или не содержит данных', 'warning');
      return;
    }

    const expectedHeaders = ['артикул', 'цвет', 'размер', 'левый_размер', 'правый_размер', 'паллет'];
    const headers = newData[0].map(h => String(h || '').toLowerCase().trim().replace(/\s+/g, '_'));
    
    const isValidHeaders = expectedHeaders.every((h, i) => headers[i] && headers[i].includes(h));
    
    if (!isValidHeaders || headers.length < 6) {
      window.showNotification(
        'Неверная структура файла. Ожидаются колонки: Артикул, Цвет, Размер, Левый_размер, Правый_размер, Паллет',
        'error'
      );
      return;
    }

    newData.shift();
    const currentDate = new Date().toISOString();
    const processedData = newData.map(row => {
      const fullRow = Array.from({ length: 6 }, (_, index) => String(row[index] || '').trim());
      fullRow.push(currentDate, user.uid, currentDate);
      return fullRow;
    });

    // УБРАНА ПРОВЕРКА НА ДУБЛИКАТЫ - разрешаем загружать одинаковые записи из Excel
    const uniqueNewData = processedData; // Теперь принимаем все данные

    if (uniqueNewData.length === 0) {
      window.showNotification('Нет данных для загрузки!', 'info');
      return;
    }

    const errors = [];
    uniqueNewData.forEach((row, index) => {
      const article = String(row[0] || '').trim();
      const color = String(row[1] || '').trim();
      const size = String(row[2] || '').trim();
      const leftSize = String(row[3] || '').trim();
      const rightSize = String(row[4] || '').trim();
      const pallet = String(row[5] || '').trim();
      
      const rowErrors = [];
      
      if (!article.match(/^\d{6}( D)?$/)) rowErrors.push('неверный артикул');
      if (!(color.length === 5 && /^\d+$/.test(color))) rowErrors.push('неверный цвет');
      if (!(size.length === 2 && /^\d+$/.test(size))) rowErrors.push('неверный размер');
      if (leftSize && !window.validateSizeFormat(leftSize)) rowErrors.push('неверный левый размер');
      if (rightSize && !window.validateSizeFormat(rightSize)) rowErrors.push('неверный правый размер');
      if (!pallet) rowErrors.push('пустой паллет');
      
      if (rowErrors.length > 0) {
        errors.push(`Строка ${index + 2}: [${article}, ${color}, ${size}, ${leftSize}, ${rightSize}, ${pallet}] — ${rowErrors.join(', ')}`);
      }
    });

    if (errors.length > 0) {
      const errorList = document.getElementById('errorList');
      if (errorList) {
        errorList.innerHTML = '<ul>' + errors.map(error => `<li class="error-item highlight">${error}</li>`).join('') + '</ul>';
        document.getElementById('errorModal').style.display = 'block';
      }
      return;
    }

    shoesData.push(...uniqueNewData);
    sessionAddedCount += uniqueNewData.length;
    displayedIndexes = shoesData.map((_, idx) => idx);
    window.renderShoesTable();

    // Используем быструю синхронизацию
    await quickDataUpdate();

    try {
      window.showNotification(`Успешно загружено ${uniqueNewData.length} записей в общую базу!`, 'success');
      await logAction('upload_excel', `Загружено ${uniqueNewData.length} записей из Excel`);
    } catch (error) {
      console.error('Ошибка синхронизации Excel:', error);
      window.showNotification(`Данные сохранены локально (ошибка синхронизации)`, 'warning');
    }

  } catch (error) {
    console.error('handleExcelUpload: Ошибка:', error);
    window.showNotification('Ошибка обработки Excel: ' + error.message, 'error');
  } finally {
    if (fileInput) {
      fileInput.value = '';
    }
  }
};

window.openScanner = function() {
  try {
    window.open('scan.html', '_blank', 'width=600,height=800');
  } catch (error) {
    console.error('openScanner: Ошибка:', error);
    window.showNotification('Ошибка открытия сканера: ' + error.message, 'error');
  }
};

window.logout = function() {
  if (isOnline && user) {
    syncToFirebase().catch(error => {
      console.error('Ошибка синхронизации при выходе:', error);
    });
  }
  
  sendUserActivity(-1);
  firebaseListeners.forEach(unsubscribe => unsubscribe());
  firebaseListeners = [];
  
  auth.signOut().then(() => {
    console.log('Выход выполнен');
  }).catch((error) => {
    console.error('Ошибка выхода:', error);
  });
};

// ========== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ==========
auth.onAuthStateChanged(async (currentUser) => {
  console.log('🔐 Проверка состояния авторизации');
  user = currentUser;
  
  if (user) {
    console.log('✅ Пользователь авторизован:', user.email);
    try {
      const userData = await createUserInFirestore(user);
      userRole = userData.role;
      console.log('🎭 Установлена роль пользователя:', userRole);

      // 1. Настраиваем слушатели
      setupRealtimeListeners();
      
      // 2. Загружаем данные из Firebase (главный источник)
      await loadInitialData();
      
      // 3. Обновляем интерфейс
      document.getElementById('userInfo').textContent = `Пользователь: ${userData.fullName} (${userRole})`;
      document.getElementById('logoutBtn').style.display = 'block';
      
      // 4. Показываем админ-панель для админов
      if (userRole === 'admin') {
        let adminBtn = document.querySelector('.admin-btn');
        if (!adminBtn) {
          adminBtn = document.createElement('button');
          adminBtn.className = 'action-btn admin-btn';
          adminBtn.innerHTML = '👑 Админ-панель';
          adminBtn.onclick = window.openAdminPanel;
          const container = document.querySelector('.header-controls') || document.querySelector('.header-section') || document.querySelector('.user-info-container') || document.getElementById('userInfo')?.parentNode;
          if (container) {
            container.appendChild(adminBtn);
          } else {
            document.body.insertBefore(adminBtn, document.body.firstChild);
          }
        }
        adminBtn.style.display = 'block';
      }
      
      updateUserPermissions();
      updateOnlineStatus();
      
      await logAction('login', `Пользователь ${userData.fullName} вошел в систему`);
      
    } catch (error) {
      console.error('❌ Ошибка инициализации пользователя:', error);
      // Резервный режим с локальными данными
      window.loadFromLocalStorage();
      updateOnlineStatus();
      window.showNotification('Вход выполнен (ограниченный режим)', 'warning');
    }
  } else {
    console.log('🚪 Пользователь не авторизован');
    window.location.href = 'login.html';
  }
});

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded: Инициализация приложения');
  
  // Назначаем обработчики событий
  const addBtn = document.getElementById('addBtn');
  if (addBtn) addBtn.addEventListener('click', window.addShoe);
  
  const filterBtn = document.getElementById('filterBtn');
  if (filterBtn) {
    filterBtn.addEventListener('click', () => window.filterTable());
  }
  
  const filterInput = document.getElementById('filterInput');
  if (filterInput) {
    filterInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        window.filterTable();
      }
    });
  }
  
  const pairBtn = document.getElementById('pairBtn');
  if (pairBtn) pairBtn.addEventListener('click', window.pairShoes);
  
  const exportShoesBtn = document.getElementById('exportShoesBtn');
  if (exportShoesBtn) exportShoesBtn.addEventListener('click', window.exportToExcel);
  
  const exportPairedBtn = document.getElementById('exportPairedBtn');
  if (exportPairedBtn) exportPairedBtn.addEventListener('click', window.exportToExcel);
  
  const statsBtn = document.querySelector('.stats-icon-btn');
  if (statsBtn) statsBtn.addEventListener('click', window.openStatsPage);
  
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', window.logout);
  
  const uploadBtn = document.getElementById('uploadBtn');
  if (uploadBtn) uploadBtn.addEventListener('click', window.handleExcelUpload);
  
  const scannerBtn = document.querySelector('.scanner-icon-btn');
  if (scannerBtn) scannerBtn.addEventListener('click', window.openScanner);
  
  // Настройка валидации полей ввода
  const setupValidation = (fieldId, validator) => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.oninput = function() {
        const value = this.value.trim();
        this.classList.remove('error', 'valid');
        if (value && !validator(value)) {
          this.classList.add('error');
        } else if (value) {
          this.classList.add('valid');
        }
      };
    }
  };
  
  setupValidation("article", v => /^\d{6}( D)?$/.test(v));
  setupValidation("color", v => v.length === 5 && /^\d+$/.test(v));
  setupValidation("size", v => v.length === 2 && /^\d+$/.test(v));
  setupValidation("leftSize", window.validateSizeFormat);
  setupValidation("rightSize", window.validateSizeFormat);
  setupValidation("pallet", v => v.length > 0);
  
  // Слушатели онлайн/офлайн статуса
  window.addEventListener('online', () => {
    updateOnlineStatus();
    window.showNotification('Соединение восстановлено', 'success');
    if (user) {
      syncToFirebase().catch(error => {
        console.error('Ошибка синхронизации при восстановлении связи:', error);
      });
    }
  });
  
  window.addEventListener('offline', () => {
    updateOnlineStatus();
    window.showNotification('Режим оффлайн. Данные сохраняются локально.', 'warning');
  });
  
  // Закрытие модальных окон
  document.querySelectorAll('.modal .close').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
      closeBtn.closest('.modal').style.display = 'none';
    });
  });
  
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });
  
  // Запуск периодической проверки данных
  startDataHealthCheck();
  
  console.log("Приложение полностью инициализировано - VERSION 8.0");
});