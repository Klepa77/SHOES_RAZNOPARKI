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


