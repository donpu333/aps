// Глобальные переменные
let isLong = true;
let stopMethod = 'atr';
let tradeType = 'long-breakout';
let allFutures = [];
let allSpot = [];
let userAlerts = [];
let currentAlertFilter = 'active';
let alertCooldowns = {};
let apiManager;
let activeTriggeredAlerts = {};

// Улучшенная функция для форматирования чисел
function formatNumber(num, decimals = 8) {
    if (isNaN(num)) return '0';
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(num * factor) / factor;
    return rounded.toString().replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.$/, '');
}

// Функции для работы с калькулятором рисков
function initRiskCalculator() {
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
    const positionSizeSpan = document.getElementById('positionSize');
    const stopLossSpan = document.getElementById('stopLoss');
    const takeProfitLevelsDiv = document.getElementById('takeProfitLevels');
    const liquidationPriceSpan = document.getElementById('liquidationPrice');
    const atrResultSpan = document.getElementById('atrResult');
    const stopMethodButtons = document.querySelectorAll('.stop-method-btn');
    const atrGroup = document.getElementById('atr-group');
    const priceGroup = document.getElementById('price-group');
    const tradeTypeButtons = document.querySelectorAll('.trade-type-btn');

    // Установка значений по умолчанию
    leverageInput.value = 10;
    leverageValue.textContent = '10x';
    atrInput.value = 5.00;
    atrValueSpan.textContent = '5.00 USDT';
    atrResultSpan.textContent = '5.00 USDT';
    riskPercentInput.value = 27;
    riskPercentValue.textContent = '27';
    previewAtrPercent.textContent = '1.35 USDT';
    previewAtrPercentValue.textContent = '27%';

    updateSliderValues();
    updateAtrPreview();
    calculateRisk();

    // Обработчики событий
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

    stopMethodButtons.forEach(button => {
        button.addEventListener('click', () => {
            stopMethod = button.dataset.method;
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

    document.getElementById('exportTextBtn').addEventListener('click', exportToText);
    document.getElementById('exportTelegramBtn').addEventListener('click', sendToTelegram);

    function updateTradeTypeButtons() {
        const tradeTypeSelector = document.getElementById('tradeTypeSelector');
        tradeTypeSelector.style.display = 'flex';

        const longBreakoutBtn = document.querySelector('.trade-type-btn.long-breakout');
        const longFakeoutBtn = document.querySelector('.trade-type-btn.long-fakeout');
        const shortBreakoutBtn = document.querySelector('.trade-type-btn.short-breakout');
        const shortFakeoutBtn = document.querySelector('.trade-type-btn.short-fakeout');

        if (isLong) {
            longBreakoutBtn.style.display = '';
            longFakeoutBtn.style.display = '';
            shortBreakoutBtn.style.display = 'none';
            shortFakeoutBtn.style.display = 'none';
            tradeType = 'long-breakout';
            longBreakoutBtn.classList.add('active');
            longFakeoutBtn.classList.remove('active');
        } else {
            longBreakoutBtn.style.display = 'none';
            longFakeoutBtn.style.display = 'none';
            shortBreakoutBtn.style.display = '';
            shortFakeoutBtn.style.display = '';
            tradeType = 'short-breakout';
            shortBreakoutBtn.classList.add('active');
            shortFakeoutBtn.classList.remove('active');
        }
    }

    function updateSliderValues() {
        riskPercentValue.textContent = riskPercentInput.value;
        rewardRatio1Value.textContent = rewardRatio1Input.value;
        rewardRatio2Value.textContent = rewardRatio2Input.value;
    }

    function updateAtrPreview() {
        const atr = parseFloat(atrInput.value) || 0;
        const riskPercent = parseFloat(riskPercentInput.value) / 100;
        atrValueSpan.textContent = formatNumber(atr, 8) + ' USDT';
        previewAtrPercent.textContent = formatNumber(atr * riskPercent, 8) + ' USDT';
        previewAtrPercentValue.textContent = riskPercentInput.value + '%';
        atrResultSpan.textContent = formatNumber(atr, 8) + ' USDT';
    }

    function calculateLiquidationPrice(entryPrice, leverage, isLong) {
        if (leverage <= 1) return isLong ? 0 : Infinity;
        if (isLong) {
            return Math.max(0, entryPrice * (1 - (1 / leverage)));
        } else {
            return entryPrice * (1 + (1 / leverage));
        }
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
                if ((isLong && stopLossPriceDirect < entryPrice) || (!isLong && stopLossPriceDirect > entryPrice)) {
                    stopLossPrice = stopLossPriceDirect;
                } else {
                    stopLossPrice = isLong ? entryPrice - (atr * riskPercent) : entryPrice + (atr * riskPercent);
                    stopLossPriceInput.value = formatNumber(stopLossPrice, 8);
                }
            } else {
                stopLossPrice = isLong ? entryPrice - (atr * riskPercent) : entryPrice + (atr * riskPercent);
            }
        }

        const priceDifference = Math.abs(entryPrice - stopLossPrice);
        const positionSize = priceDifference > 0 ? (riskAmount / priceDifference) : 0;
        const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, isLong);

        entryPriceResult.textContent = `${formatNumber(entryPrice, 8)} USDT`;
        positionSizeSpan.textContent = formatNumber(positionSize, 8);
        stopLossSpan.textContent = `${formatNumber(stopLossPrice, 8)} USDT`;
        liquidationPriceSpan.textContent = `${formatNumber(liquidationPrice, 8)} USDT`;
        generateTakeProfitLevels(entryPrice, stopLossPrice, isLong, rewardRatio1, rewardRatio2, positionSize);
    }

    function generateTakeProfitLevels(entryPrice, stopLossPrice, isLong, ratio1, ratio2, positionSize) {
        takeProfitLevelsDiv.innerHTML = '';
        const levels = [ratio1, ratio2];

        levels.forEach(ratio => {
            let takeProfitPrice;
            if (isLong) {
                takeProfitPrice = entryPrice + (entryPrice - stopLossPrice) * ratio;
            } else {
                takeProfitPrice = entryPrice - (stopLossPrice - entryPrice) * ratio;
            }

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

    function exportToText() {
        const entryPrice = parseFloat(entryPriceInput.value) || 0;
        const leverage = parseFloat(leverageInput.value) || 1;
        const atr = parseFloat(atrInput.value) || 0;
        const riskPercent = parseFloat(riskPercentInput.value);
        const riskAmount = parseFloat(riskAmountInput.value) || 0;
        const rewardRatio1 = parseFloat(rewardRatio1Input.value) || 3;
        const rewardRatio2 = parseFloat(rewardRatio2Input.value) || 5;
        const stopLossPriceDirect = parseFloat(stopLossPriceInput.value) || 0;

        let tradeTypeName = '';
        switch(tradeType) {
            case 'long-breakout': tradeTypeName = 'Лонг Пробой'; break;
            case 'long-fakeout': tradeTypeName = 'Лонг Ложный пробой'; break;
            case 'short-breakout': tradeTypeName = 'Шорт Пробой'; break;
            case 'short-fakeout': tradeTypeName = 'Шорт Ложный пробой'; break;
        }

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
${Array.from(takeProfitLevelsDiv.children).map(el => el.textContent.trim().replace(/\s+/g, ' ')).join('\n')}

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
        const entryPrice = parseFloat(entryPriceInput.value) || 0;
        const leverage = parseFloat(leverageInput.value) || 1;
        const riskAmount = parseFloat(riskAmountInput.value) || 0;
        const atr = parseFloat(atrInput.value) || 0;
        const riskPercent = parseFloat(riskPercentInput.value) || 0;

        let tradeTypeName = '';
        switch(tradeType) {
            case 'long-breakout': tradeTypeName = 'Лонг Пробой'; break;
            case 'long-fakeout': tradeTypeName = 'Лонг Ложный пробой'; break;
            case 'short-breakout': tradeTypeName = 'Шорт Пробой'; break;
            case 'short-fakeout': tradeTypeName = 'Шорт Ложный пробой'; break;
        }

        const stopMethodName = stopMethod === 'atr' ? 'По ATR' : 'По цене';
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
}

// Функции для работы с калькулятором среднего
function calculateAverage() {
    const input = document.getElementById('numbersInput').value.trim();
    const resultDiv = document.getElementById('result');

    if (!input) {
        resultDiv.innerHTML = '<p style="color: #F44336;">Введите числа!</p>';
        return;
    }

    let numbers;
    try {
        numbers = input.split(' ')
            .map(num => num.replace(',', '.'))
            .filter(num => num !== '')
            .map(num => {
                const parsed = parseFloat(num);
                if (isNaN(parsed)) throw new Error();
                return parsed;
            });

        if (numbers.length === 0) throw new Error();
    } catch {
        resultDiv.innerHTML = '<p style="color: #F44336;">Ошибка: вводите только числа, разделённые пробелами!</p>';
        return;
    }

    const sum = numbers.reduce((sum, num) => sum + num, 0);
    const count = numbers.length;
    const mean = sum / count;
    const deviations = numbers.map(num => num - mean);

    resultDiv.innerHTML = `
        <div style="background: rgba(30,30,30,0.5); padding: 10px; border-radius: 5px;">
            <p><strong>Чисел:</strong> ${count}</p>
            <p><strong>Сумма:</strong> ${formatNumber(sum, 8)}</p>
            <p><strong>Среднее:</strong> ${formatNumber(mean, 8)}</p>
            <p><strong>Отклонения:</strong></p>
            <ul style="padding-left: 20px;">
                ${numbers.map((num, i) =>
                    `<li>${formatNumber(num, 8)} - ${formatNumber(mean, 8)} = ${formatNumber(deviations[i], 8)}</li>`
                ).join('')}
            </ul>
        </div>
    `;
}

// Функции для работы с предпосылками
let currentVisibleText = null;

function toggleText(type) {
    document.querySelectorAll('.text-display').forEach(el => el.style.display = 'none');
    
    if (currentVisibleText === type) {
        currentVisibleText = null;
        document.getElementById('actionButtons').style.display = 'none';
    } else {
        document.getElementById(`${type}Text`).style.display = 'block';
        currentVisibleText = type;
        document.getElementById('actionButtons').style.display = 'flex';
    }
}

function getSelectedItems() {
    let selectedItems = [];
    let container = document.getElementById(`${currentVisibleText}Text`);
    if (!container) return [];
    
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    checkboxes.forEach((checkbox, index) => {
        const itemText = checkbox.nextElementSibling.textContent.trim();
        selectedItems.push(`${index+1}. ${itemText}`);
    });
    
    return selectedItems;
}

function copySelectedText() {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) {
        showStatus('Выберите хотя бы один пункт для копирования', 3000, 'error');
        return;
    }
    
    let textToCopy = '';
    if (currentVisibleText === 'breakthrough') {
        textToCopy = 'Пробой\n📊Предпосылки\n';
    } else if (currentVisibleText === 'falseBreakthrough') {
        textToCopy = 'Ложный пробой\n📊Предпосылки\n';
    } else if (currentVisibleText === 'breakthroughMinuses') {
        textToCopy = 'Пробой минусы\n⛔️ Минусы\n';
    } else if (currentVisibleText === 'falseBreakthroughMinuses') {
        textToCopy = 'Ложный пробой минусы\n⛔️ Минусы\n';
    }
    
    textToCopy += selectedItems.join('\n');
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        showStatus('Выбранные пункты скопированы!', 3000, 'success');
    }).catch(err => {
        showStatus('Не удалось скопировать текст: ' + err, 5000, 'error');
    });
}

function exportSelectedToTelegram() {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) {
        showStatus('Выберите хотя бы один пункт для отправки', 3000, 'error');
        return;
    }
    
    let textToSend = '';
    if (currentVisibleText === 'breakthrough') {
        textToSend = 'Пробой\n📊Предпосылки\n';
    } else if (currentVisibleText === 'falseBreakthrough') {
        textToSend = 'Ложный пробой\n📊Предпосылки\n';
    } else if (currentVisibleText === 'breakthroughMinuses') {
        textToSend = 'Пробой минусы\n⛔️ Минусы\n';
    } else if (currentVisibleText === 'falseBreakthroughMinuses') {
        textToSend = 'Ложный пробой минусы\n⛔️ Минусы\n';
    }
    
    textToSend += selectedItems.join('\n');
    
    const botToken = '8044055704:AAGk8cQFayPqYCscLlEB3qGRj0Uw_NTpe30';
    const chatId = '1720793889';
    
    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: textToSend
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.ok) {
            showStatus('Выбранные пункты успешно отправлены в Telegram!', 3000, 'success');
        } else {
            showStatus('Ошибка при отправке: ' + data.description, 5000, 'error');
        }
    })
    .catch(error => {
        showStatus('Ошибка: ' + error.message, 5000, 'error');
    });
}

function resetCheckboxes() {
    const container = document.getElementById(`${currentVisibleText}Text`);
    if (!container) return;
    
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    showStatus('Все галочки сброшены', 2000, 'success');
}

function showStatus(message, duration, type) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = 'status-message ' + type;
    statusElement.style.display = 'block';
    
    setTimeout(() => {
        statusElement.style.display = 'none';
    }, duration);
}

// Остальные функции (аутентификация, алерты и т.д.) остаются без изменений
// ...

document.addEventListener('DOMContentLoaded', async () => {
    apiManager = new BinanceAPIManager();
    
    try {
        await apiManager.init();
        loadAppState();
        setupEventListeners();
        await loadMarketData();
        loadUserAlerts(currentAlertFilter);
        
        // Инициализация калькулятора рисков
        initRiskCalculator();
        
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
