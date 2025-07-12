// Глобальная переменная для хранения данных
let shoesData = [];

// Функция рендера таблицы исходных данных (определена заранее)
function renderShoesTable(data) {
  const tableBody = document.getElementById('shoesTable').getElementsByTagName('tbody')[0];
  console.log(tableBody)
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

function saveRow(id){
  alert('Функция co[] пока не реализована. ID: ' + id);

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
