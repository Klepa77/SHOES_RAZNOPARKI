// Глобальная переменная для хранения данных
let shoesData = [];

// Функция рендера таблицы исходных данных (определена заранее)
function renderShoesTable(data) {
  const tableBody = document.getElementById('shoesTable').getElementsByTagName('tbody')[0];
  console.log(tableBody);
  tableBody.innerHTML = ''; // Очищаем текущие строки

  // Проходим по всем строкам данных
  data.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row[0] || ''}</td> <!-- Артикул -->
      <td>${row[1] || ''}</td> <!-- Цвет -->
      <td>${row[2] || ''}</td> <!-- Размер -->
      <td>${row[3] || ''}</td> <!-- Левый размер -->
      <td>${row[4] || ''}</td> <!-- Правый размер -->
      <td>${row[5] || ''}</td> <!-- Артикул др-й пары -->
      <td>${row[6] || ''}</td> <!-- Цвет др-й пары -->
      <td>${row[7] || ''}</td> <!-- Левый разм. др-й пары -->
      <td>${row[8] || ''}</td> <!-- Правый разм. др-й пары -->
      <td>${row[9] || ''}</td> <!-- Паллет -->
      <td>
        <div class="action-buttons">
          <button class="action-btn edit-btn" onclick="editRow('${index + 1}')">Редактировать</button>
          <button class="action-btn save-btn" onclick="saveRow('${index + 1}')">Сохранить</button>
          <button class="action-btn delete-btn" onclick="deleteRow('${index + 1}')">Удалить</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

// Пустые функции для placeholder
function editRow(id) {
  alert('Функция редактирования пока не реализована. ID: ' + id);
}

function saveRow(id) {
  alert('Функция сохранения пока не реализована. ID: ' + id);
}

function deleteRow(id) {
  alert('Функция удаления пока не реализована. ID: ' + id);
}

// Обработчик события для загрузки файла
document.getElementById('uploadBtn').addEventListener('click', () => {
  const reader = new FileReader();
  const fileInput = document.getElementById('excelInput');
  const file = fileInput.files[0]; // Получаем выбранный файл

  // Проверяем, выбран ли файл
  if (!file) {
    alert('Пожалуйста, выберите файл Excel!');
    return;
  }

  reader.onload = (e) => {
    try {
      // Парсим Excel-файл с помощью SheetJS
      const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      if (!workbook.SheetNames.length) {
        throw new Error('Файл не содержит листов.');
      }
      const sheet = workbook.Sheets[workbook.SheetNames[0]]; // Берем первый лист
      shoesData = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Преобразуем в массив с заголовками
      if (!shoesData.length) {
        throw new Error('Файл не содержит данных.');
      }
      console.log(shoesData); // Выводим массив в консоль
      shoesData.shift(); // Удаляем заголовок из данных
      renderShoesTable(shoesData); // Рендерим таблицу
    } catch (error) {
      alert('Ошибка при чтении файла: ' + error.message);
    }
  };

  reader.readAsArrayBuffer(file); // Начинаем чтение файла
});

function addShoe() {
  // Получаем значения из формы
  const article = document.getElementById("article").value || "";
  const color = document.getElementById("color").value || "";
  const size = document.getElementById("size").value || "";
  const leftSize = document.getElementById("leftSize").value || "";
  const rightSize = document.getElementById("rightSize").value || "";
  const otherArticle = document.getElementById("otherArticle").value || "";
  const otherColor = document.getElementById("otherColor").value || "";
  const otherLeftSize = document.getElementById("otherLeftSize").value || "";
  const otherRightSize = document.getElementById("otherRightSize").value || "";
  const pallet = document.getElementById("pallet").value || "";

  // Парсинг размеров (если есть "/", разбиваем, иначе оставляем как есть)
  const parseSize = (sizeValue) => {
    if (sizeValue.includes("/")) {
      const [left, right] = sizeValue.split("/").map(s => s.trim());
      return `${left}/${right}`; // Сохраняем формат "левый/правый"
    }
    return sizeValue; // Оставляем как есть (например, "43")
  };

  // Формируем новую строку
  const newRow = [
    article,
    color,
    size,
    parseSize(leftSize),
    parseSize(rightSize),
    otherArticle,
    otherColor,
    parseSize(otherLeftSize),
    parseSize(otherRightSize),
    pallet
  ];

  // Добавляем новую строку в shoesData
  shoesData.push(newRow);

  // Обновляем таблицу
  renderShoesTable(shoesData);

  // Очищаем форму (опционально)
  document.getElementById("article").value = "";
  document.getElementById("color").value = "";
  document.getElementById("size").value = "";
  document.getElementById("leftSize").value = "";
  document.getElementById("rightSize").value = "";
  document.getElementById("otherArticle").value = "";
  document.getElementById("otherColor").value = "";
  document.getElementById("otherLeftSize").value = "";
  document.getElementById("otherRightSize").value = "";
  document.getElementById("pallet").value = "";
}

// Привязываем функцию к кнопке "Добавить"
document.getElementById("addBtn").addEventListener("click", addShoe);

// Валидация формы

// Динамическая валидация для артикула
document.getElementById("article").oninput = function() {
  const value = this.value.trim();
  this.style.border = "1px solid #ccc";
  if (!value || !(/^\d{6}( D)?$/.test(value))) {
    this.style.border = "2px solid red";
  } else {
    this.style.border = "2px solid green";
  }
};

// Динамическая валидация для цвета
document.getElementById("color").oninput = function() {
  const value = this.value.trim();
  this.style.border = "1px solid #ccc";
  if (!value || !(value.length === 5 && /^\d+$/.test(value))) {
    this.style.border = "2px solid red";
  } else {
    this.style.border = "2px solid green";
  }
};

// Динамическая валидация для основного размера
document.getElementById("size").oninput = function() {
  const value = this.value.trim();
  this.style.border = "1px solid #ccc";
  if (!value || !(value.length === 2 && /^\d+$/.test(value))) {
    this.style.border = "2px solid red";
  } else {
    this.style.border = "2px solid green";
  }
};

// Динамическая валидация для дополнительного артикула
document.getElementById("otherArticle").oninput = function() {
  const value = this.value.trim();
  this.style.border = "1px solid #ccc";
  if (value && !(/^\d{6}( D)?$/.test(value))) {
    this.style.border = "2px solid red";
  } else {
    this.style.border = "2px solid green";
  }
};

// Функция для проверки форматов XX и XX/XX
function validateSizeFormat(value) {
  value = value.trim();
  // Проверяем два варианта: ровно 2 цифры ИЛИ 2 цифры + / + 2 цифры
  return /^\d{2}$/.test(value) || /^\d{2}\/\d{2}$/.test(value);
}

// Динамическая валидация для левого размера
document.getElementById("leftSize").oninput = function() {
  const value = this.value.trim();
  this.style.border = "1px solid #ccc";
  if (value && !validateSizeFormat(value)) {
    this.style.border = "2px solid red";
  } else {
    this.style.border = "2px solid green";
  }
};

// Динамическая валидация для правого размера
document.getElementById("rightSize").oninput = function() {
  const value = this.value.trim();
  this.style.border = "1px solid #ccc";
  if (value && !validateSizeFormat(value)) {
    this.style.border = "2px solid red";
  } else {
    this.style.border = "2px solid green";
  }
};

// Динамическая валидация для дополнительного левого размера
document.getElementById("otherLeftSize").oninput = function() {
  const value = this.value.trim();
  this.style.border = "1px solid #ccc";
  if (value && !validateSizeFormat(value)) {
    this.style.border = "2px solid red";
  } else {
    this.style.border = "2px solid green";
  }
};

// Динамическая валидация для дополнительного правого размера
document.getElementById("otherRightSize").oninput = function() {
  const value = this.value.trim();
  this.style.border = "1px solid #ccc";
  if (value && !validateSizeFormat(value)) {
    this.style.border = "2px solid red";
  } else {
    this.style.border = "2px solid green";
  }
};

// Динамическая валидация для дополнительного цвета
document.getElementById("otherColor").oninput = function() {
  const value = this.value.trim();
  this.style.border = "1px solid #ccc";
  if (value && !(value.length === 5 && /^\d+$/.test(value))) {
    this.style.border = "2px solid red";
  } else {
    this.style.border = "2px solid green";
  }
};

// Динамическая валидация для паллета
document.getElementById("pallet").oninput = function() {
  const value = this.value.trim();
  this.style.border = "1px solid #ccc";
  if (!value || !(value.length > 0)) {
    this.style.border = "2px solid red";
  } else {
    this.style.border = "2px solid green";
  }
};

// Функция проверки всей формы
function validateForm() {
  const fields = {
    article: { 
      id: "article", 
      required: true, 
      validate: function(value) { 
        return /^\d{6}( D)?$/.test(value.trim()); 
      } 
    },
    color: { 
      id: "color", 
      required: true, 
      validate: function(value) { 
        return value.trim().length === 5 && /^\d+$/.test(value); 
      } 
    },
    size: { 
      id: "size", 
      required: true, 
      validate: function(value) { 
        return value.trim().length === 2 && /^\d+$/.test(value); 
      } 
    },
    leftSize: { 
      id: "leftSize", 
      required: false, 
      validate: function(value) { 
        return !value || validateSizeFormat(value); 
      } 
    },
    rightSize: { 
      id: "rightSize", 
      required: false, 
      validate: function(value) { 
        return !value || validateSizeFormat(value); 
      } 
    },
    otherArticle: { 
      id: "otherArticle", 
      required: false, 
      validate: function(value) { 
        return !value || /^\d{6}( D)?$/.test(value.trim()); 
      } 
    },
    otherColor: { 
      id: "otherColor", 
      required: false, 
      validate: function(value) { 
        return !value || (value.trim().length === 5 && /^\d+$/.test(value)); 
      } 
    },
    otherLeftSize: { 
      id: "otherLeftSize", 
      required: false, 
      validate: function(value) { 
        return !value || validateSizeFormat(value); 
      } 
    },
    otherRightSize: { 
      id: "otherRightSize", 
      required: false, 
      validate: function(value) { 
        return !value || validateSizeFormat(value); 
      } 
    },
    pallet: { 
      id: "pallet", 
      required: true, 
      validate: function(value) { 
        return value.trim().length > 0; 
      } 
    }
  };

  // Сбрасываем все границы перед проверкой
  Object.values(fields).forEach(function(field) {
    document.getElementById(field.id).style.border = "1px solid #ccc";
  });

  let hasError = false;
  for (let fieldName in fields) {
    const field = fields[fieldName];
    const inputElement = document.getElementById(field.id);
    const inputValue = inputElement.value.trim();
    
    // Проверяем только если поле обязательно или заполнено
    if (field.required || inputValue) {
      if (!field.validate(inputValue)) {
        inputElement.style.border = "2px solid red";
        hasError = true;
      } else {
        inputElement.style.border = "2px solid green";
      }
    }
  }

  return !hasError;
}

// Функция добавления данных
function addShoe() {
  if (validateForm()) {
    const formData = {
      article: document.getElementById("article").value.trim(),
      color: document.getElementById("color").value.trim(),
      size: document.getElementById("size").value.trim(),
      leftSize: document.getElementById("leftSize").value.trim(),
      rightSize: document.getElementById("rightSize").value.trim(),
      otherArticle: document.getElementById("otherArticle").value.trim(),
      otherColor: document.getElementById("otherColor").value.trim(),
      otherLeftSize: document.getElementById("otherLeftSize").value.trim(),
      otherRightSize: document.getElementById("otherRightSize").value.trim(),
      pallet: document.getElementById("pallet").value.trim()
    };

    // Добавляем данные (предполагается, что shoesData и renderShoesTable существуют)
    shoesData.push(Object.values(formData));
    renderShoesTable(shoesData);

    // Очищаем все поля формы
    Object.keys(formData).forEach(function(fieldName) {
      document.getElementById(fieldName).value = "";
      document.getElementById(fieldName).style.border = "1px solid #ccc";
    });
  }
}

// Назначаем обработчик кнопке "Добавить"
document.getElementById("addBtn").addEventListener("click", addShoe);

// Новая функция фильтрации (исправлена для обработки ошибок и рендера только по клику)
function filterTable() {
  const filterInput = document.getElementById('filterInput');
  const filterBtn = document.getElementById('filterBtn');
  if (!filterInput || !filterBtn) {
    console.error('Элементы filterInput или filterBtn не найдены в DOM');
    return;
  }

  const filterValue = filterInput.value.trim().toLowerCase();
  if (!filterValue) {
    renderShoesTable(shoesData); // Показываем все данные, если фильтр пуст
    console.log('Нет данных для фильтрации, показаны все данные');
    return;
  }

  const filteredData = [];
  const seen = new Set();

  const [artInput = '', colorInput = '', sizeInput = ''] = filterValue.split(' ').map(s => s.trim());
  const isExactMatch = artInput.startsWith('=');
  const artSearch = isExactMatch ? artInput.slice(1) : artInput;

  shoesData.forEach(row => {
    const art0 = row[0] && typeof row[0] === 'string' ? row[0].toLowerCase() : '';
    const color = row[1] && typeof row[1] === 'string' ? row[1].toLowerCase() : '';
    const size = row[3] && typeof row[3] === 'string' ? row[3].split('/')[0].trim() : '';
    const art5 = row[5] && typeof row[5] === 'string' ? row[5].toLowerCase() : ''; // Безопасная обработка
    const pallet = row[9] && typeof row[9] === 'string' ? row[9].toLowerCase() : '';

    let match = false;
    if (isExactMatch) {
      match = art0 === artSearch;
    } else if (artSearch) {
      match = art0.startsWith(artSearch);
    }
    if (art5 && artSearch && (isExactMatch ? art5 === artSearch : art5.startsWith(artSearch))) match = true;
    if (artSearch === 'd' && (art0.includes('d') || (art5 && art5.includes('d')))) match = true;
    if (colorInput && color !== colorInput) match = false;
    if (sizeInput && size !== sizeInput) match = false;
    if (pallet === filterValue) match = true;

    if (match && !seen.has(row.join('|'))) {
      filteredData.push(row);
      seen.add(row.join('|'));
    }
  });

  renderShoesTable(filteredData); // Рендерим отфильтрованные данные
  console.log('Отфильтрованные данные:', filteredData); // Выводим для отладки
  if (filterBtn.matches(':active')) {
    filterInput.value = ''; // Очистка инпута при клике на кнопку
  }
}

// Инициализация фильтрации (только по клику)
document.addEventListener('DOMContentLoaded', () => {
  const filterInput = document.getElementById('filterInput');
  const filterBtn = document.getElementById('filterBtn');
  if (filterInput && filterBtn) {
    filterBtn.addEventListener('click', filterTable); // Только по клику
  } else {
    console.error('Элементы filterInput или filterBtn не найдены при загрузке');
  }
});