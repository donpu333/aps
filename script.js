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

const TG_BOT_TOKEN = '8044055704:AAGk8cQFayPqYCscLlEB3qGRj0Uw_NTpe30';

let allFutures = [];
let allSpot = [];
let userAlerts = [];
let currentAlertFilter = 'active';
let alertCooldowns = {};
let apiManager;
let activeTriggeredAlerts = {};

// Функции для работы с пользователями
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function handleRegister() {
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword')?.value;

    if (!email || !password || !confirmPassword) {
        showNotification('Ошибка', 'Все поля обязательны для заполнения');
        return;
    }

    if (!isValidEmail(email)) {
        showNotification('Ошибка', 'Введите корректный email');
        return;
    }

    if (password.length < 8) {
        showNotification('Ошибка', 'Пароль должен содержать минимум 8 символов');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('Ошибка', 'Пароли не совпадают');
        return;
    }

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userExists = users.some(user => user.email === email);

    if (userExists) {
        showNotification('Ошибка', 'Пользователь с таким email уже зарегистрирован');
        return;
    }

    const newUser = {
        email: email,
        password: btoa(password),
        createdAt: new Date().toISOString(),
        alerts: []
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify({ email: email }));

    showNotification('Успех', 'Регистрация прошла успешно!');
    closeRegisterModal();
    updateUserUI(email);
}

function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showNotification('Ошибка', 'Введите email и пароль');
        return;
    }

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === email && atob(u.password) === password);

    if (!user) {
        showNotification('Ошибка', 'Неверный email или пароль');
        return;
    }

    localStorage.setItem('currentUser', JSON.stringify({ email: email }));
    showNotification('Успех', 'Вход выполнен успешно!');
    closeLoginModal();
    updateUserUI(email);
}

function handleLogout() {
    localStorage.removeItem('currentUser');
    showNotification('Успех', 'Вы успешно вышли из системы');
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
        if (userProfileBtn) userProfileBtn.classList.remove('hidden');
        if (userName) userName.textContent = email.split('@')[0];
        if (loginMenuItem) loginMenuItem.classList.add('hidden');
        if (registerMenuItem) registerMenuItem.classList.add('hidden');
        if (logoutMenuItem) logoutMenuItem.classList.remove('hidden');
    } else {
        if (userProfileBtn) userProfileBtn.classList.add('hidden');
        if (loginMenuItem) loginMenuItem.classList.remove('hidden');
        if (registerMenuItem) registerMenuItem.classList.remove('hidden');
        if (logoutMenuItem) logoutMenuItem.classList.add('hidden');
    }
}

// ... (все промежуточные функции остаются без изменений)

// Калькулятор рисков - обновленные функции
function initCalculator() {
    leverageInput.value = 10;
    leverageValue.textContent = '10x';

    updateSliderValues();
    updateAtrPreview();
    calculateRisk();

    longBtn.addEventListener('click', () => {
        isLong = true;
        longBtn.classList.add('active');
        shortBtn.classList.remove('active');
        updateTradeTypeButtons();
        calculateRisk();
    });

    shortBtn.addEventListener('click', () => {
        isLong = false;
        shortBtn.classList.add('active');
        longBtn.classList.remove('active');
        updateTradeTypeButtons();
        calculateRisk();
    });

    const tradeTypeButtons = document.querySelectorAll('.trade-type-btn');
    tradeTypeButtons.forEach(button => {
        button.addEventListener('click', () => {
            tradeType = button.dataset.type;
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

    const stopMethodButtons = document.querySelectorAll('.stop-method-btn');
    stopMethodButtons.forEach(button => {
        button.addEventListener('click', () => {
            stopMethod = button.dataset.method;
            stopMethodButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            document.getElementById('atr-group').classList.remove('active');
            document.getElementById('price-group').classList.remove('active');

            if (stopMethod === 'atr') {
                document.getElementById('atr-group').classList.add('active');
            } else {
                document.getElementById('price-group').classList.add('active');
            }

            calculateRisk();
        });
    });

    stopLossPriceInput.addEventListener('input', () => {
        const entryPrice = parseFloat(entryPriceInput.value) || 0;
        const stopLossPrice = parseFloat(stopLossPriceInput.value) || 0;

        if (entryPrice > 0 && stopLossPrice > 0) {
            const difference = Math.abs(entryPrice - stopLossPrice);
            priceDifferenceSpan.textContent = difference.toFixed(8) + ' USDT';
        } else {
            priceDifferenceSpan.textContent = '0.00 USDT';
        }

        calculateRisk();
    });

    document.getElementById('exportTextBtn').addEventListener('click', exportToText);
    document.getElementById('exportTelegramBtn').addEventListener('click', sendToTelegram);
}

function calculateRisk() {
    const entryPrice = parseFloat(entryPriceInput.value) || 0;
    const leverage = parseFloat(leverageInput.value) || 1;
    const atr = parseFloat(atrInput.value) || 0;
    const riskPercent = parseFloat(riskPercentInput.value) / 100;
    const riskAmount = parseFloat(riskAmountInput.value) || 0;
    const rewardRatio1 = parseFloat(rewardRatio1Input.value) || 3;
    const rewardRatio2 = parseFloat(rewardRatio2Input.value) || 5;
    const stopLossPriceDirect = parseFloat(stopLossPriceInput.value) || 0;

    let stopLossPrice;
    if (stopMethod === 'atr') {
        stopLossPrice = isLong ? entryPrice - (atr * riskPercent) : entryPrice + (atr * riskPercent);
    } else {
        if (stopLossPriceDirect > 0) {
            if ((isLong && stopLossPriceDirect < entryPrice) ||
                (!isLong && stopLossPriceDirect > entryPrice)) {
                stopLossPrice = stopLossPriceDirect;
            } else {
                stopLossPrice = isLong ? entryPrice - (atr * riskPercent) : entryPrice + (atr * riskPercent);
                stopLossPriceInput.value = stopLossPrice.toFixed(8);
            }
        } else {
            stopLossPrice = isLong ? entryPrice - (atr * riskPercent) : entryPrice + (atr * riskPercent);
        }
    }

    const priceDifference = Math.abs(entryPrice - stopLossPrice);
    const positionSize = priceDifference > 0 ? (riskAmount / priceDifference) : 0;
    const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, isLong);

    entryPriceResult.textContent = `${entryPrice.toFixed(8)} USDT`;
    positionSizeSpan.textContent = `${formatNumber(positionSize)}`;
    stopLossSpan.textContent = `${stopLossPrice.toFixed(8)} USDT`;
    atrResultSpan.textContent = `${atr.toFixed(8)} USDT`;
    liquidationPriceSpan.textContent = `${liquidationPrice.toFixed(8)} USDT`;

    generateTakeProfitLevels(entryPrice, stopLossPrice, isLong, rewardRatio1, rewardRatio2, positionSize);
}

function exportToText() {
    const entryPrice = parseFloat(entryPriceInput.value) || 0;
    const leverage = parseFloat(leverageInput.value) || 1;
    const atr = parseFloat(atrInput.value) || 0;
    const riskPercent = parseFloat(riskPercentInput.value) || 0;
    const riskAmount = parseFloat(riskAmountInput.value) || 0;

    let tradeTypeName = '';
    switch (tradeType) {
        case 'long-breakout': tradeTypeName = 'Лонг Пробой'; break;
        case 'long-fakeout': tradeTypeName = 'Лонг Ложный пробой'; break;
        case 'short-breakout': tradeTypeName = 'Шорт Пробой'; break;
        case 'short-fakeout': tradeTypeName = 'Шорт Ложный пробой'; break;
    }

    const content = `Калькулятор рисков - Результаты
===============================
Дата: ${new Date().toLocaleString()}
Направление: ${isLong ? 'Лонг' : 'Шорт'}
Тип сделки: ${tradeTypeName}
Метод ввода стоп-лосса: ${stopMethod === 'atr' ? 'По ATR' : 'По цене'}

Параметры сделки:
-----------------
Цена входа: ${entryPrice.toFixed(8)} USDT
Кредитное плечо: ${leverage}x
ATR: ${atr.toFixed(8)} USDT
Риск стоп-лосс: ${riskPercent}% от ATR
Риск на сделку: ${riskAmount.toFixed(8)} USDT
Соотношение тейк-профита: 1:${rewardRatio1Input.value} и 1:${rewardRatio2Input.value}

Результаты:
-----------
Цена входа: ${entryPrice.toFixed(8)} USDT
Размер позиции: ${positionSizeSpan.textContent}
Стоп-лосс: ${stopLossSpan.textContent}

Уровни тейк-профита:
${Array.from(document.getElementById('takeProfitLevels').children).map(el =>
    '• ' + el.textContent.trim().replace(/\s+/g, ' ')
).join('\n')}

Цена ликвидации: ${liquidationPriceSpan.textContent}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'расчет_рисков.txt';
    a.click();
    URL.revokeObjectURL(url);
}

// ... (все остальные функции остаются без изменений)

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    apiManager = new BinanceAPIManager();

    try {
        await apiManager.init();
        loadAppState();
        setupEventListeners();
        await loadMarketData();
        loadUserAlerts(currentAlertFilter);

        const savedChatId = localStorage.getItem('tg_chat_id');
        if (savedChatId) {
            const userChatId = document.getElementById('userChatId');
            if (userChatId) userChatId.value = savedChatId;
        }

        const savedEmail = localStorage.getItem('userEmail');
        if (savedEmail) {
            const userEmail = document.getElementById('userEmail');
            if (userEmail) userEmail.value = savedEmail;
        }

        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (currentUser && currentUser.email) {
            updateUserUI(currentUser.email);
        }

        setInterval(checkAlerts, 2000);
    } catch (error) {
        console.error('Failed to initialize application:', error);
        showNotification('Critical Error', 'Failed to connect to Binance API');
    }
});

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showNotification('System Error', event.message || 'Unknown error occurred');
});
