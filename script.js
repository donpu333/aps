// Глобальные переменные
let isLong = true;
let stopMethod = 'atr';
let tradeType = 'long-breakout';

// Функция для показа/скрытия текста
function toggleText(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = element.style.display === 'none' ? 'block' : 'none';
    }
    return false; // Для предотвращения действия по умолчанию
}

// Улучшенная функция для форматирования чисел
function formatNumber(num, decimals = 8) {
    if (isNaN(num)) return '0';
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(num * factor) / factor;
    return rounded.toString().replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.$/, '');
}

// Конфигурация API
const API_CONFIG = {
    RECONNECT_INTERVAL: 5000,
    TIMEOUT: 10000,
    MAX_RETRIES: 3,
    ENDPOINTS: {
        TEST: 'https://api.binance.com/api/v3/ping',
        FUTURES: 'https://fapi.binance.com',
        SPOT: 'https://api.binance.com'
    }
};

// ... [здесь должны быть все остальные функции и переменные из вашего кода]

// Калькулятор рисков
document.addEventListener('DOMContentLoaded', function() {
    // Элементы интерфейса
    const longBtn = document.getElementById('longBtn');
    const shortBtn = document.getElementById('shortBtn');
    const entryPriceInput = document.getElementById('entryPrice');
    const leverageInput = document.getElementById('leverage');
    const atrInput = document.getElementById('atr');
    const riskPercentInput = document.getElementById('riskPercent');
    const previewAtrPercent = document.getElementById('previewAtrPercent');
    
    // Инициализация с ATR 10% по умолчанию
    function init() {
        // Установка значений по умолчанию
        leverageInput.value = 10;
        atrInput.value = 5.00;
        riskPercentInput.value = 10; // Установлено 10% вместо 27%
        
        // Обновление отображаемых значений
        updateSliderValues();
        updateAtrPreview();
        calculateRisk();
    }

    function updateAtrPreview() {
        const atr = parseFloat(atrInput.value) || 0;
        const riskPercent = parseFloat(riskPercentInput.value) / 100;
        previewAtrPercent.textContent = formatNumber(atr * riskPercent, 8) + ' USDT';
    }

    // ... [остальные функции калькулятора]

    init();
});

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    // Инициализация API менеджера
    apiManager = new BinanceAPIManager();
    
    try {
        await apiManager.init();
        loadAppState();
        setupEventListeners();
        await loadMarketData();
        loadUserAlerts(currentAlertFilter);
        
        // Проверка авторизации пользователя
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (currentUser && currentUser.email) {
            updateUserUI(currentUser.email);
        }
        
        // Запуск проверки алертов
        setInterval(checkAlerts, 2000);
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showNotification('Ошибка', 'Не удалось подключиться к Binance API');
    }
});

// Глобальный обработчик ошибок
window.addEventListener('error', (event) => {
    console.error('Глобальная ошибка:', event.error);
    showNotification('Системная ошибка', event.message || 'Произошла неизвестная ошибка');
});

// Назначение глобальных функций
window.toggleText = toggleText;
window.formatNumber = formatNumber;
// ... [другие глобальные функции]
