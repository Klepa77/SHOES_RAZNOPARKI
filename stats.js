function getMonthlyStats() {
  console.log('getMonthlyStats: Начало сбора статистики');
  const storedData = localStorage.getItem('eccoShoesData');
  if (!storedData) {
    console.log('getMonthlyStats: Нет данных в localStorage');
    return {};
  }

  const parsed = JSON.parse(storedData);
  const shoesData = parsed.shoesData || [];
  const pairedList = parsed.pairedList || [];
  console.log('getMonthlyStats: Загружено записей:', shoesData.length, 'пар:', pairedList.length);

  const monthlyStats = {};

  shoesData.forEach((row, index) => {
    const dateAdded = row[6] || new Date().toISOString();
    const monthKey = dateAdded.slice(0, 7);
    console.log(`getMonthlyStats: Строка ${index}: дата ${dateAdded}, месяц ${monthKey}`);

    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = { loaded: 0, paired: 0 };
    }
    monthlyStats[monthKey].loaded++;
  });

  pairedList.forEach(pair => {
    const dateAdded = shoesData[pair.i][6] || new Date().toISOString();
    const monthKey = dateAdded.slice(0, 7);

    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = { loaded: 0, paired: 0 };
    }
    monthlyStats[monthKey].paired += pair.count || 1;
  });

  console.log('getMonthlyStats: Итоговая статистика:', monthlyStats);

  const sortedStats = {};
  Object.keys(monthlyStats).sort().forEach(key => {
    sortedStats[key] = monthlyStats[key];
  });

  return sortedStats;
}

function renderStatsChart() {
  const stats = getMonthlyStats();
  const months = Object.keys(stats);
  if (months.length === 0) {
    console.log('renderStatsChart: Нет данных для диаграммы');
    return;
  }

  const loadedData = months.map(month => stats[month].loaded);
  const pairedData = months.map(month => stats[month].paired);

  const ctx = document.getElementById('statsChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Загружено',
          data: loadedData,
          backgroundColor: 'rgba(52, 152, 219, 0.6)',
          borderColor: 'rgba(52, 152, 219, 1)',
          borderWidth: 1
        },
        {
          label: 'Спарено',
          data: pairedData,
          backgroundColor: 'rgba(46, 204, 113, 0.6)',
          borderColor: 'rgba(46, 204, 113, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Количество' } },
        x: { title: { display: true, text: 'Месяц' } }
      },
      plugins: {
        legend: { display: true, position: 'top' },
        title: { display: true, text: 'Статистика по месяцам' }
      }
    }
  });
}

function renderStatsTable() {
  const stats = getMonthlyStats();
  const tbody = document.getElementById('statsTable').getElementsByTagName('tbody')[0];
  tbody.innerHTML = '';

  if (Object.keys(stats).length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999;">Нет данных для отображения</td></tr>';
    return;
  }

  Object.keys(stats).forEach(month => {
    const row = tbody.insertRow();
    row.insertCell(0).textContent = month;
    row.insertCell(1).textContent = stats[month].loaded;
    row.insertCell(2).textContent = stats[month].paired;
  });
}

function exportStatsCSV() {
  const stats = getMonthlyStats();
  const months = Object.keys(stats);
  if (months.length === 0) {
    alert('Нет данных для экспорта');
    return;
  }

  const csvData = [
    ['Месяц', 'Загружено', 'Спарено'],
    ...months.map(month => [month, stats[month].loaded, stats[month].paired])
  ];
  const csvContent = csvData.map(row => row.join(',')).join('\n');
  // Используем TextEncoder для явной кодировки UTF-8
  const encoder = new TextEncoder();
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // BOM для UTF-8
  const encodedContent = encoder.encode(csvContent);
  const blob = new Blob([bom, encodedContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ecco_stats.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function exportStatsPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const stats = getMonthlyStats();
  const months = Object.keys(stats);
  if (months.length === 0) {
    alert('Нет данных для экспорта');
    return;
  }

  let yPosition = 20;
  doc.setFontSize(16);
  doc.text('Статистика по месяцам', 20, yPosition); // Заголовок (пока без кириллицы)
  yPosition += 10;

  // Таблица с границами
  doc.setFontSize(12);
  doc.text('Month', 20, yPosition); // Английский заголовок вместо кириллицы
  doc.text('Loaded', 50, yPosition);
  doc.text('Paired', 80, yPosition);
  yPosition += 10;

  months.forEach(month => {
    if (yPosition > 280) {
      doc.addPage();
      yPosition = 20;
      doc.text('Month', 20, yPosition);
      doc.text('Loaded', 50, yPosition);
      doc.text('Paired', 80, yPosition);
      yPosition += 10;
    }
    doc.text(month, 20, yPosition);
    doc.text(stats[month].loaded.toString(), 50, yPosition);
    doc.text(stats[month].paired.toString(), 80, yPosition);
    yPosition += 10;
  });

  try {
    doc.save('ecco_stats.pdf');
  } catch (e) {
    console.error('Ошибка при сохранении PDF:', e);
    alert('Ошибка при экспорте PDF. Проверь консоль.');
  }
}
// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  console.log('stats.js: Инициализация статистики');
  renderStatsChart();
  renderStatsTable();

  const csvButton = document.querySelector('.export-buttons button:first-child');
  const pdfButton = document.querySelector('.export-buttons button:last-child');
  if (csvButton) csvButton.addEventListener('click', exportStatsCSV);
  if (pdfButton) pdfButton.addEventListener('click', exportStatsPDF);
});