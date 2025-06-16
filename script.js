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

// Конфигурация Telegram - ваш токен бота
const TG_BOT_TOKEN = '8044055704:AAGk8cQFayPqYCscLlEB3qGRj0Uw_NTpe30';

let allFutures = [];
let allSpot = [];
let userAlerts = [];
let currentAlertFilter = 'active';
let alertCooldowns = {};
let apiManager;
let activeTriggeredAlerts = {};

// Глобальные переменные для калькулятора риска
let isLong = true;
let stopMethod = 'atr';
let tradeType = 'long-breakout';

// Улучшенная функция для форматирования чисел
function formatNumber(num, decimals = 8) {
    if (isNaN(num)) return '0';
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(num * factor) / factor;
    return rounded.toString().replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.$/, '');
}

// Функции для работы с пользователями
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function handleRegister() {
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    // Валидация полей
    if (!email || !password || !confirmPassword) {
        showNotification('Все поля обязательны для заполнения', 'error');
        return;
    }

    if (!isValidEmail(email)) {
        showNotification('Введите корректный email', 'error');
        return;
    }

    if (password.length < 8) {
        showNotification('Пароль должен содержать минимум 8 символов', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }

    // Проверяем, есть ли уже такой пользователь
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userExists = users.some(user => user.email === email);

    if (userExists) {
        showNotification('Пользователь с таким email уже зарегистрирован', 'error');
        return;
    }

    // Создаем нового пользователя
    const newUser = {
        email: email,
        password: btoa(password),
        createdAt: new Date().toISOString(),
        alerts: [],
        telegramSettings: {
            botToken: '',
            chatId: ''
        }
    };

    // Сохраняем пользователя
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify({ email: email }));

    showNotification('Регистрация прошла успешно!', 'success');
    closeRegisterModal();

    // Обновляем интерфейс для зарегистрированного пользователя
    updateUserUI(email);
}

function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showNotification('Введите email и пароль', 'error');
        return;
    }

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === email && atob(u.password) === password);

    if (!user) {
        showNotification('Неверный email или пароль', 'error');
        return;
    }

    localStorage.setItem('currentUser', JSON.stringify({ email: email }));
    showNotification('Вход выполнен успешно!', 'success');
    closeLoginModal();
    updateUserUI(email);
}

function handleLogout() {
    localStorage.removeItem('currentUser');
    showNotification('Вы успешно вышли из системы', 'success');
    updateUserUI(null);
    toggleMenu();
}

function updateUserUI(email) {
    const userProfileBtn = document.getElementById('userProfileBtn');
    const userName = document.getElementById('userName');
    const loginMenuItem = document.getElementById('loginMenuItem');
    const registerMenuItem = document.getElementById('registerMenuItem');
    const logoutMenuItem = document.getElementById('logoutMenuItem');

    if (email) {
        // Пользователь авторизован
        if (userProfileBtn) userProfileBtn.classList.remove('hidden');
        if (userName) userName.textContent = email.split('@')[0];
        if (loginMenuItem) loginMenuItem.classList.add('hidden');
        if (registerMenuItem) registerMenuItem.classList.add('hidden');
        if (logoutMenuItem) logoutMenuItem.classList.remove('hidden');
    } else {
        // Гость
        if (userProfileBtn) userProfileBtn.classList.add('hidden');
        if (loginMenuItem) loginMenuItem.classList.remove('hidden');
        if (registerMenuItem) registerMenuItem.classList.remove('hidden');
        if (logoutMenuItem) logoutMenuItem.classList.add('hidden');
    }
}

// Функции для работы с Telegram
function showTelegramSettings() {
    toggleMenu();
    const modal = document.getElementById('telegramSettingsModal');
    if (modal) {
        modal.classList.add('active');
    }

    // Устанавливаем значения по умолчанию
    document.getElementById('telegramBotToken').value = '8044055704:AAGk8cQFayPqYCscLlEB3qGRj0Uw_NTpe30';
    document.getElementById('telegramChatId').value = '1720793889';

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === currentUser?.email);

    if (user) {
        document.getElementById('telegramBotToken').value = user.telegramSettings?.botToken || '8044055704:AAGk8cQFayPqYCscLlEB3qGRj0Uw_NTpe30';
        document.getElementById('telegramChatId').value = user.telegramSettings?.chatId || '1720793889';
    }
}

function closeTelegramSettingsModal() {
    document.getElementById('telegramSettingsModal').classList.remove('active');
}

function saveTelegramSettings() {
    const botToken = document.getElementById('telegramBotToken').value.trim();
    const chatId = document.getElementById('telegramChatId').value.trim();

    if (!botToken || !chatId) {
        showNotification('Заполните все поля', 'error');
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser || !currentUser.email) {
        showNotification('Пользователь не авторизован', 'error');
        return;
    }

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => u.email === currentUser.email);

    if (userIndex !== -1) {
        if (!users[userIndex].telegramSettings) {
            users[userIndex].telegramSettings = {};
        }

        users[userIndex].telegramSettings.botToken = botToken;
        users[userIndex].telegramSettings.chatId = chatId;

        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify({
            ...currentUser,
            telegramSettings: {
                botToken: botToken,
                chatId: chatId
            }
        }));

        showNotification('Настройки Telegram сохранены', 'success');
    } else {
        showNotification('Пользователь не найден', 'error');
    }
}

async function testTelegramConnection() {
    const botToken = document.getElementById('telegramBotToken').value.trim();
    const chatId = document.getElementById('telegramChatId').value.trim();

    if (!botToken || !chatId) {
        showNotification('Заполните все поля', 'error');
        return;
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: '✅ Проверка связи: Crypto Calculator успешно подключен к вашему Telegram!',
                parse_mode: 'Markdown'
            })
        });

        const data = await response.json();

        if (data.ok) {
            showNotification('Сообщение успешно отправлено в Telegram!', 'success');
        } else {
            showNotification('Ошибка при отправке: ' + (data.description || 'неизвестная ошибка'), 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения: ' + error.message, 'error');
    }
}

async function sendToTelegram() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === currentUser?.email);

    if (!user || !user.telegramSettings || !user.telegramSettings.botToken || !user.telegramSettings.chatId) {
        showNotification('Настройки Telegram не найдены', 'error');
        return;
    }

    const botToken = user.telegramSettings.botToken;
    const chatId = user.telegramSettings.chatId;

    const entryPrice = parseFloat(document.getElementById('entryPrice').value) || 0;
    const leverage = parseFloat(document.getElementById('leverage').value) || 1;
    const riskAmount = parseFloat(document.getElementById('riskAmount').value) || 0;
    const atr = parseFloat(document.getElementById('atr').value) || 0;
    const riskPercent = parseFloat(document.getElementById('riskPercent').value) || 0;

    // Получаем название типа сделки
    let tradeTypeName = '';
    switch(tradeType) {
        case 'long-breakout': tradeTypeName = 'Лонг Пробой'; break;
        case 'long-fakeout': tradeTypeName = 'Лонг Ложный пробой'; break;
        case 'short-breakout': tradeTypeName = 'Шорт Пробой'; break;
        case 'short-fakeout': tradeTypeName = 'Шорт Ложный пробой'; break;
    }

    // Получаем метод расчета стоп-лосса
    const stopMethodName = stopMethod === 'atr' ? 'По ATR' : 'По цене';

    // Формируем текст сообщения
    const messageText = `
📊 Результаты расчета позиции 📊

Направление: ${isLong ? 'Лонг' : 'Шорт'} (${tradeTypeName})
Цена входа: ${formatNumber(entryPrice, 8)} USDT
Плечо: ${leverage}x
Стоп-лосс: ${stopMethod === 'price' ? formatNumber(document.getElementById('stopLossPrice').value, 8) + ' USDT (расчётный)' : formatNumber(atr * riskPercent / 100, 8) + ' USDT (' + riskPercent + '% от ATR)'}
Риск на сделку: ${formatNumber(riskAmount, 8)} USDT
Метод расчета стоп-лосса: ${stopMethodName}

Размер позиции: ${formatNumber(document.getElementById('positionSize').textContent.split(' ')[0], 8)}
Стоп-лосс: ${formatNumber(document.getElementById('stopLoss').textContent.split(' ')[0], 8)} USDT

Тейк-профиты:
${Array.from(document.getElementById('takeProfitLevels').children).map(el => {
    const parts = el.textContent.trim().split(/\s+/);
    return `• ${parts[0]} ${parts[1]} ${formatNumber(parts[2], 8)} USDT ${parts[3]} ${formatNumber(parts[4], 8)} USDT`;
}).join('\n')}

Цена ликвидации: ${formatNumber(document.getElementById('liquidationPrice').textContent.split(' ')[0], 8)} USDT
`;

    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: messageText,
                parse_mode: 'Markdown'
            })
        });

        const data = await response.json();

        if (data.ok) {
            showNotification('Расчет успешно отправлен в Telegram!', 'success');
        } else {
            showNotification('Ошибка при отправке: ' + (data.description || 'неизвестная ошибка'), 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения: ' + error.message, 'error');
    }
}

// Функция для показа уведомлений
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.display = 'block';

    // Устанавливаем цвет в зависимости от типа уведомления
    if (type === 'error') {
        notification.style.backgroundColor = '#F44336';
    } else if (type === 'success') {
        notification.style.backgroundColor = '#4CAF50';
    } else {
        notification.style.backgroundColor = '#2196F3';
    }

    // Скрываем уведомление через 3 секунды
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Risk Calculator Functions
document.addEventListener('DOMContentLoaded', function() {
    // Элементы интерфейса
    const longBtn = document.getElementById('longBtn');
    const shortBtn = document.getElementById('shortBtn');
    const entryPriceInput = document.getElementById('entryPrice');
    const entryPriceResult = document.getElementById('entryPriceResult');
    const leverageInput = document.getElementById('leverage');
    const leverageValue = document.getElementById('leverageValue');
    const leverageWarning = document.getElementById('leverageWarning');
    const atrInput = document.getElementById('atr');
    const riskPercentInput = document.getElementById('riskPercent');
    const riskPercentValue = document.getElementById('riskPercentValue');
    const riskAmountInput = document.getElementById('riskAmount');
    const rewardRatio1Input = document.getElementById('rewardRatio1');
    const rewardRatio1Value = document.getElementById('rewardRatio1Value');
    const rewardRatio2Input = document.getElementById('rewardRatio2');
    const rewardRatio2Value = document.getElementById('rewardRatio2Value');
    const atrValueSpan = document.getElementById('atrValue');
    const previewAtrPercent = document.getElementById('previewAtrPercent');
    const previewAtrPercentValue = document.getElementById('previewAtrPercentValue');
    const stopLossPriceInput = document.getElementById('stopLossPrice');
    const priceDifferenceSpan = document.getElementById('priceDifference');

    // Элементы результатов
    const positionSizeSpan = document.getElementById('positionSize');
    const stopLossSpan = document.getElementById('stopLoss');
    const takeProfitLevelsDiv = document.getElementById('takeProfitLevels');
    const liquidationPriceSpan = document.getElementById('liquidationPrice');
    const atrResultSpan = document.getElementById('atrResult');

    // Переключатели метода ввода стоп-лосса
    const stopMethodButtons = document.querySelectorAll('.stop-method-btn');
    const atrGroup = document.getElementById('atr-group');
    const priceGroup = document.getElementById('price-group');

    // Кнопки типа сделки
    const tradeTypeButtons = document.querySelectorAll('.trade-type-btn');

    // Инициализация
    function init() {
        // Установка плеча по умолчанию на 10
        leverageInput.value = 10;
        leverageValue.textContent = '10x';

        // Установка ATR по умолчанию на 5
        atrInput.value = 5.00;
        atrValueSpan.textContent = '5.00 USDT';
        atrResultSpan.textContent = '5.00 USDT';

        // Установка риска по умолчанию на 27%
        riskPercentInput.value = 27;
        riskPercentValue.textContent = '27';
        previewAtrPercent.textContent = '1.35 USDT';
        previewAtrPercentValue.textContent = '27%';

        updateSliderValues();
        updateAtrPreview();
        calculateRisk();

        // Назначение обработчиков событий
        longBtn.addEventListener('click', () => {
            isLong = true;
            longBtn.classList.add('active');
            shortBtn.classList.remove('active');

            // Обновляем кнопки типа сделки
            updateTradeTypeButtons();
            calculateRisk();
        });

        shortBtn.addEventListener('click', () => {
            isLong = false;
            shortBtn.classList.add('active');
            longBtn.classList.remove('active');

            // Обновляем кнопки типа сделки
            updateTradeTypeButtons();
            calculateRisk();
        });

        // Обработчики для кнопки типа сделки
        tradeTypeButtons.forEach(button => {
            button.addEventListener('click', () => {
                tradeType = button.dataset.type;

                // Обновляем активные кнопки
                tradeTypeButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                calculateRisk();
            });
        });

        entryPriceInput.addEventListener('input', calculateRisk);
        leverageInput.addEventListener('input', () => {
            leverageValue.textContent = leverageInput.value + 'x';
            if (leverageInput.value > 10) {
                leverageWarning.style.display = 'block';
            } else {
                leverageWarning.style.display = 'none';
            }
            calculateRisk();
        });
        atrInput.addEventListener('input', () => {
            updateAtrPreview();
            calculateRisk();
        });
        riskPercentInput.addEventListener('input', () => {
            updateSliderValues();
            updateAtrPreview();
            calculateRisk();
        });
        riskAmountInput.addEventListener('input', calculateRisk);
        rewardRatio1Input.addEventListener('input', () => {
            updateSliderValues();
            calculateRisk();
        });
        rewardRatio2Input.addEventListener('input', () => {
            updateSliderValues();
            calculateRisk();
        });

        // Обработчики для переключателя метода ввода стоп-лосса
        stopMethodButtons.forEach(button => {
            button.addEventListener('click', () => {
                stopMethod = button.dataset.method;

                // Обновляем активные кнопки и группы ввода
                stopMethodButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                atrGroup.classList.remove('active');
                priceGroup.classList.remove('active');

                if (stopMethod === 'atr') {
                    atrGroup.classList.add('active');
                } else {
                    priceGroup.classList.add('active');
                }

                calculateRisk();
            });
        });

        // Обработчик для прямого ввода цены стоп-лосса
        stopLossPriceInput.addEventListener('input', () => {
            const entryPrice = parseFloat(entryPriceInput.value) || 0;
            const stopLossPrice = parseFloat(stopLossPriceInput.value) || 0;

            if (entryPrice > 0 && stopLossPrice > 0) {
                const difference = Math.abs(entryPrice - stopLossPrice);
                priceDifferenceSpan.textContent = formatNumber(difference, 8) + ' USDT';
            } else {
                priceDifferenceSpan.textContent = '0 USDT';
            }

            calculateRisk();
        });

        // Инициализация кнопки экспорта
        document.getElementById('exportTextBtn').addEventListener('click', exportToText);
        document.getElementById('exportTelegramBtn').addEventListener('click', sendToTelegram);

        // Проверяем авторизацию пользователя
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (currentUser && currentUser.email) {
            updateUserUI(currentUser.email);
        }
    }

    // Обновление кнопок типа сделки в зависимости от направления
    function updateTradeTypeButtons() {
        const tradeTypeSelector = document.getElementById('tradeTypeSelector');
        tradeTypeSelector.style.display = 'flex';

        const longBreakoutBtn = document.querySelector('.trade-type-btn.long-breakout');
        const longFakeoutBtn = document.querySelector('.trade-type-btn.long-fakeout');
        const shortBreakoutBtn = document.querySelector('.trade-type-btn.short-breakout');
        const shortFakeoutBtn = document.querySelector('.trade-type-btn.short-fakeout');

        if (isLong) {
            // Показываем только лонг кнопки
            longBreakoutBtn.style.display = '';
            longFakeoutBtn.style.display = '';
            shortBreakoutBtn.style.display = 'none';
            shortFakeoutBtn.style.display = 'none';

            // Активируем лонг пробой по умолчанию
            tradeType = 'long-breakout';
            longBreakoutBtn.classList.add('active');
            longFakeoutBtn.classList.remove('active');
        } else {
            // Показываем только шорт кнопки
            longBreakoutBtn.style.display = 'none';
            longFakeoutBtn.style.display = 'none';
            shortBreakoutBtn.style.display = '';
            shortFakeoutBtn.style.display = '';

            // Активируем шорт пробой по умолчанию
            tradeType = 'short-breakout';
            shortBreakoutBtn.classList.add('active');
            shortFakeoutBtn.classList.remove('active');
        }
    }

    // Обновление значений слайдеров
    function updateSliderValues() {
        riskPercentValue.textContent = riskPercentInput.value;
        rewardRatio1Value.textContent = rewardRatio1Input.value;
        rewardRatio2Value.textContent = rewardRatio2Input.value;
    }

    // Предварительный просмотр ATR
    function updateAtrPreview() {
        const atr = parseFloat(atrInput.value) || 0;
        const riskPercent = parseFloat(riskPercentInput.value) / 100;

        // Отображаем точное значение ATR без округления
        atrValueSpan.textContent = formatNumber(atr, 8) + ' USDT';
        previewAtrPercent.textContent = formatNumber(atr * riskPercent, 8) + ' USDT';
        previewAtrPercentValue.textContent = riskPercentInput.value + '%';
        atrResultSpan.textContent = formatNumber(atr, 8) + ' USDT';
    }

    // Расчет цены ликвидации
    function calculateLiquidationPrice(entryPrice, leverage, isLong) {
        if (leverage <= 1) return isLong ? 0 : Infinity;
        
        if (isLong) {
            return Math.max(0, entryPrice * (1 - (1 / leverage)));
        } else {
            return entryPrice * (1 + (1 / leverage));
        }
    }

    // Основная функция расчета
    function calculateRisk() {
        const entryPrice = parseFloat(entryPriceInput.value) || 0;
        const leverage = parseFloat(leverageInput.value) || 1;
        const atr = parseFloat(atrInput.value) || 0;
        const riskPercent = parseFloat(riskPercentInput.value) / 100;
        const riskAmount = parseFloat(riskAmountInput.value) || 0;
        const rewardRatio1 = parseFloat(rewardRatio1Input.value) || 3;
        const rewardRatio2 = parseFloat(rewardRatio2Input.value) || 5;
        const stopLossPriceDirect = parseFloat(stopLossPriceInput.value) || 0;

        // Расчет стоп-лосса в зависимости от выбранного метода
        let stopLossPrice;
        if (stopMethod === 'atr') {
            if (isLong) {
                stopLossPrice = entryPrice - (atr * riskPercent);
            } else {
                stopLossPrice = entryPrice + (atr * riskPercent);
            }
        } else {
            // Проверяем корректность введенной цены стоп-лосса
            if (stopLossPriceDirect > 0) {
                if ((isLong && stopLossPriceDirect < entryPrice) ||
                    (!isLong && stopLossPriceDirect > entryPrice)) {
                    stopLossPrice = stopLossPriceDirect;
                } else {
                    // Некорректная цена стоп-лосса - используем расчет через ATR
                    if (isLong) {
                        stopLossPrice = entryPrice - (atr * riskPercent);
                    } else {
                        stopLossPrice = entryPrice + (atr * riskPercent);
                    }
                    // Обновляем поле ввода
                    stopLossPriceInput.value = formatNumber(stopLossPrice, 8);
                }
            } else {
                // Если цена стоп-лосса не введена, используем расчет через ATR
                if (isLong) {
                    stopLossPrice = entryPrice - (atr * riskPercent);
                } else {
                    stopLossPrice = entryPrice + (atr * riskPercent);
                }
            }
        }

        // Точный расчет размера позиции
        const priceDifference = Math.abs(entryPrice - stopLossPrice);
        const positionSize = priceDifference > 0 ? 
            (riskAmount / priceDifference) : 0;

        // Расчет цены ликвидации
        const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, isLong);

        // Обновление интерфейса
        entryPriceResult.textContent = `${formatNumber(entryPrice, 8)} USDT`;
        positionSizeSpan.textContent = formatNumber(positionSize, 8);
        stopLossSpan.textContent = `${formatNumber(stopLossPrice, 8)} USDT`;
        liquidationPriceSpan.textContent = `${formatNumber(liquidationPrice, 8)} USDT`;

        // Генерация уровней тейк-профита
        generateTakeProfitLevels(entryPrice, stopLossPrice, isLong, rewardRatio1, rewardRatio2, positionSize);
    }

    // Генерация уровней тейк-профита
    function generateTakeProfitLevels(entryPrice, stopLossPrice, isLong, ratio1, ratio2, positionSize) {
        takeProfitLevelsDiv.innerHTML = '';

        // Создаем массив уровней тейк-профита
        const levels = [ratio1, ratio2];

        levels.forEach(ratio => {
            let takeProfitPrice;
            if (isLong) {
                takeProfitPrice = entryPrice + (entryPrice - stopLossPrice) * ratio;
            } else {
                takeProfitPrice = entryPrice - (stopLossPrice - entryPrice) * ratio;
            }

            // Правильный расчет прибыли
            const priceDiff = Math.abs(takeProfitPrice - entryPrice);
            const profit = priceDiff * positionSize;

            const levelDiv = document.createElement('div');
            levelDiv.className = 'take-profit-item';
            levelDiv.innerHTML = `
                <span class="take-profit-ratio">Тейк-профит 1к${ratio}</span>
                <span class="take-profit-price">${formatNumber(takeProfitPrice, 8)} USDT</span>
                <span class="take-profit-value">+${formatNumber(profit, 8)} USDT</span>
            `;
            takeProfitLevelsDiv.appendChild(levelDiv);
        });
    }

    // Экспорт в текстовый файл
    function exportToText() {
        const entryPrice = parseFloat(document.getElementById('entryPrice').value) || 0;
        const leverage = parseFloat(document.getElementById('leverage').value) || 1;
        const atr = parseFloat(document.getElementById('atr').value) || 0;
        const riskPercent = parseFloat(document.getElementById('riskPercent').value);
        const riskAmount = parseFloat(document.getElementById('riskAmount').value) || 0;
        const rewardRatio1 = parseFloat(document.getElementById('rewardRatio1').value) || 3;
        const rewardRatio2 = parseFloat(document.getElementById('rewardRatio2').value) || 5;
        const stopLossPriceDirect = parseFloat(document.getElementById('stopLossPrice').value) || 0;

        // Получаем название типа сделки
        let tradeTypeName = '';
        switch(tradeType) {
            case 'long-breakout': tradeTypeName = 'Лонг Пробой'; break;
            case 'long-fakeout': tradeTypeName = 'Лонг Ложный пробой'; break;
            case 'short-breakout': tradeTypeName = 'Шорт Пробой'; break;
            case 'short-fakeout': tradeTypeName = 'Шорт Ложный пробой'; break;
        }

        // Получаем метод расчета стоп-лосса
        const stopMethodName = stopMethod === 'atr' ? 'По ATR' : 'По цене';

        const content = `
Калькулятор рисков - Результаты
===============================
Дата: ${new Date().toLocaleString()}
Направление: ${isLong ? 'Лонг' : 'Шорт'}
Тип сделки: ${tradeTypeName}
Метод расчета стоп-лосса: ${stopMethodName}

Параметры сделки:
-----------------
Цена входа: ${formatNumber(entryPrice, 8)} USDT
Кредитное плечо: ${leverage}x
${stopMethod === 'atr' ? `ATR: ${formatNumber(atr, 8)} USDT\nРиск стоп-лосс: ${riskPercent}% от ATR` : `Цена стоп-лосса: ${formatNumber(stopLossPriceDirect, 8)} USDT`}
Риск на сделку: ${formatNumber(riskAmount, 8)} USDT
Соотношение тейк-профита: 1:${rewardRatio1} и 1:${rewardRatio2}

Результаты:
-----------
Цена входа: ${formatNumber(entryPrice, 8)} USDT
Размер позиции: ${formatNumber(positionSizeSpan.textContent, 8)}
Стоп-лосс: ${formatNumber(stopLossSpan.textContent, 8)} USDT

Уровни тейк-профита:
${Array.from(takeProfitLevelsDiv.children).map(el =>
    el.textContent.trim().replace(/\s+/g, ' ')
).join('\n')}

Цена ликвидации: ${formatNumber(liquidationPriceSpan.textContent, 8)} USDT
        `;

        const blob = new Blob([content], {type: 'text/plain'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'расчет_рисков.txt';
        a.click();
        URL.revokeObjectURL(url);
    }

    // Запуск приложения
    init();
});

// Остальной код остается без изменений...

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    apiManager = new BinanceAPIManager();

    try {
        await apiManager.init();
        loadAppState();
        setupEventListeners();
        await loadMarketData();
        loadUserAlerts(currentAlertFilter);

        // Проверяем сохраненный chat_id
        const savedChatId = localStorage.getItem('tg_chat_id');
        if (savedChatId) {
            const userChatId = document.getElementById('userChatId');
            if (userChatId) userChatId.value = savedChatId;
        }

        // Проверяем сохраненный email
        const savedEmail = localStorage.getItem('userEmail');
        if (savedEmail) {
            const userEmail = document.getElementById('userEmail');
            if (userEmail) userEmail.value = savedEmail;
        }

        // Проверяем авторизацию пользователя
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (currentUser && currentUser.email) {
            updateUserUI(currentUser.email);
        }

        // Запускаем проверку алертов каждые 2 секунды
        setInterval(checkAlerts, 2000);
    } catch (error) {
        console.error('Failed to initialize application:', error);
        showNotification('Critical Error', 'Failed to connect to Binance API');
    }
});

// Глобальный обработчик ошибок
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showNotification('System Error', event.message || 'Unknown error occurred');
});

window.createAlertForSymbol = createAlertForSymbol;
window.deleteAlert = deleteAlert;
window.applyCurrentPrice = applyCurrentPrice;
window.applyCurrentPriceForEdit = applyCurrentPriceForEdit;
window.editAlert = editAlert;
window.closeEditModal = closeEditModal;
window.openTelegramSettings = openTelegramSettings;
window.closeTelegramSettings = closeTelegramSettings;
window.saveTelegramSettings = saveTelegramSettings;
window.showBotConnectionHint = showBotConnectionHint;
window.closeBotConnectionHint = closeBotConnectionHint;
window.showHome = showHome;
window.showLoginForm = showLoginForm;
window.closeLoginModal = closeLoginModal;
window.showRegisterForm = showRegisterForm;
window.closeRegisterModal = closeRegisterModal;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.toggleMenu = toggleMenu;
window.resetForm = resetForm;
window.calculateAverage = calculateAverage;
window.resetCheckboxes = resetCheckboxes;
