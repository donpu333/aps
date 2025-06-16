// Основная функция расчета с улучшенной точностью
function calculateRisk() {
    const entryPrice = parseFloat(entryPriceInput.value) || 0;
    const leverage = parseFloat(leverageInput.value) || 1;
    const atr = parseFloat(atrInput.value) || 0;
    const riskPercent = parseFloat(riskPercentInput.value) / 100;
    const riskAmount = parseFloat(riskAmountInput.value) || 0;
    const rewardRatio1 = parseFloat(rewardRatio1Input.value) || 3;
    const rewardRatio2 = parseFloat(rewardRatio2Input.value) || 5;
    const stopLossPriceDirect = parseFloat(stopLossPriceInput.value) || 0;

    // Расчет стоп-лосса с повышенной точностью
    let stopLossPrice;
    if (stopMethod === 'atr') {
        if (isLong) {
            stopLossPrice = entryPrice - (atr * riskPercent);
        } else {
            stopLossPrice = entryPrice + (atr * riskPercent);
        }
    } else {
        if (stopLossPriceDirect > 0) {
            if ((isLong && stopLossPriceDirect < entryPrice) ||
                (!isLong && stopLossPriceDirect > entryPrice)) {
                stopLossPrice = stopLossPriceDirect;
            } else {
                if (isLong) {
                    stopLossPrice = entryPrice - (atr * riskPercent);
                } else {
                    stopLossPrice = entryPrice + (atr * riskPercent);
                }
                stopLossPriceInput.value = stopLossPrice.toFixed(8);
            }
        } else {
            if (isLong) {
                stopLossPrice = entryPrice - (atr * riskPercent);
            } else {
                stopLossPrice = entryPrice + (atr * riskPercent);
            }
        }
    }

    // Точный расчет размера позиции
    const priceDifference = Math.abs(entryPrice - stopLossPrice);
    const positionSize = priceDifference > 0 ? (riskAmount / priceDifference) : 0;

    // Расчет цены ликвидации с повышенной точностью
    const liquidationPrice = isLong 
        ? entryPrice * (1 - (1 / leverage)) 
        : entryPrice * (1 + (1 / leverage));

    // Обновление интерфейса с точными значениями
    entryPriceResult.textContent = `${entryPrice.toFixed(8)} USDT`;
    positionSizeSpan.textContent = `${formatNumber(positionSize)}`;
    stopLossSpan.textContent = `${stopLossPrice.toFixed(8)} USDT`;
    atrResultSpan.textContent = `${atr.toFixed(8)} USDT`;
    liquidationPriceSpan.textContent = `${liquidationPrice.toFixed(8)} USDT`;

    // Генерация уровней тейк-профита
    generateTakeProfitLevels(entryPrice, stopLossPrice, isLong, rewardRatio1, rewardRatio2, positionSize);
}

// Улучшенная функция форматирования чисел
function formatNumber(num) {
    if (num === 0) return '0';
    
    // Для очень больших или очень маленьких чисел используем экспоненциальную запись
    if (Math.abs(num) < 0.000001 || Math.abs(num) > 1000000) {
        return num.toExponential(6);
    }
    
    // Определяем оптимальное количество знаков после запятой
    const absNum = Math.abs(num);
    let precision;
    
    if (absNum >= 1000) {
        precision = 2;
    } else if (absNum >= 1) {
        precision = 4;
    } else if (absNum >= 0.01) {
        precision = 6;
    } else {
        precision = 8;
    }
    
    // Форматируем число и удаляем лишние нули
    return num.toFixed(precision).replace(/(\.0*|(?<=\.\d*?)0*)$/, '');
}

// Улучшенная функция экспорта в текстовый файл
function exportToText() {
    const entryPrice = parseFloat(entryPriceInput.value) || 0;
    const leverage = parseFloat(leverageInput.value) || 1;
    const atr = parseFloat(atrInput.value) || 0;
    const riskPercent = parseFloat(riskPercentInput.value) || 0;
    const riskAmount = parseFloat(riskAmountInput.value) || 0;

    // Получаем название типа сделки
    let tradeTypeName = '';
    switch (tradeType) {
        case 'long-breakout': tradeTypeName = 'Лонг Пробой'; break;
        case 'long-fakeout': tradeTypeName = 'Лонг Ложный пробой'; break;
        case 'short-breakout': tradeTypeName = 'Шорт Пробой'; break;
        case 'short-fakeout': tradeTypeName = 'Шорт Ложный пробой'; break;
    }

    // Форматируем дату
    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth()+1).toString().padStart(2, '0')}.${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Формируем содержимое файла с точными значениями
    const content = `
Калькулятор рисков - Результаты
===============================
Дата: ${formattedDate}
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
Размер позиции: ${formatNumber(riskAmount / Math.abs(entryPrice - parseFloat(stopLossSpan.textContent.split(' ')[0])))}
Стоп-лосс: ${stopLossSpan.textContent}

Уровни тейк-профита:
${Array.from(document.getElementById('takeProfitLevels').children).map(el =>
    '• ' + el.textContent.trim().replace(/\s+/g, ' ')
).join('\n')}

Цена ликвидации: ${liquidationPriceSpan.textContent}

Расчет размера позиции:
Риск на сделку: ${riskAmount.toFixed(8)} USDT
Разница цены: ${Math.abs(entryPrice - parseFloat(stopLossSpan.textContent.split(' ')[0])).toFixed(8)} USDT
Размер позиции = Риск / Разница цены = ${riskAmount.toFixed(8)} / ${Math.abs(entryPrice - parseFloat(stopLossSpan.textContent.split(' ')[0])).toFixed(8)} = ${formatNumber(riskAmount / Math.abs(entryPrice - parseFloat(stopLossSpan.textContent.split(' ')[0])))}
    `;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `расчет_рисков_${formattedDate.replace(/[:.]/g, '-').replace(' ', '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// Улучшенная функция для отправки в Telegram
async function sendToTelegram() {
    const botToken = '8044055704:AAGk8cQFayPqYCscLlEB3qGRj0Uw_NTpe30';
    const chatId = '1720793889';

    const entryPrice = parseFloat(entryPriceInput.value) || 0;
    const leverage = parseFloat(leverageInput.value) || 1;
    const atr = parseFloat(atrInput.value) || 0;
    const riskPercent = parseFloat(riskPercentInput.value) || 0;
    const riskAmount = parseFloat(riskAmountInput.value) || 0;

    // Получаем название типа сделки
    let tradeTypeName = '';
    switch (tradeType) {
        case 'long-breakout': tradeTypeName = 'Лонг Пробой'; break;
        case 'long-fakeout': tradeTypeName = 'Лонг Ложный пробой'; break;
        case 'short-breakout': tradeTypeName = 'Шорт Пробой'; break;
        case 'short-fakeout': tradeTypeName = 'Шорт Ложный пробой'; break;
    }

    // Форматируем дату
    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth()+1).toString().padStart(2, '0')}.${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Формируем текст сообщения с точными значениями
    const positionSize = riskAmount / Math.abs(entryPrice - parseFloat(stopLossSpan.textContent.split(' ')[0]));
    const priceDifference = Math.abs(entryPrice - parseFloat(stopLossSpan.textContent.split(' ')[0]));

    const messageText = `
📊 *Результаты расчета позиции* 📊
*Дата:* ${formattedDate}

*Направление:* ${isLong ? 'Лонг' : 'Шорт'} (${tradeTypeName})
*Метод стоп-лосса:* ${stopMethod === 'atr' ? 'По ATR' : 'По цене'}

*Параметры сделки:*
Цена входа: ${entryPrice.toFixed(8)} USDT
Плечо: ${leverage}x
ATR: ${atr.toFixed(8)} USDT
Риск стоп-лосс: ${riskPercent}%
Риск на сделку: ${riskAmount.toFixed(8)} USDT
Соотношение TP: 1:${rewardRatio1Input.value} и 1:${rewardRatio2Input.value}

*Результаты:*
Размер позиции: ${formatNumber(positionSize)}
Стоп-лосс: ${stopLossSpan.textContent}

*Уровни тейк-профита:*
${Array.from(document.getElementById('takeProfitLevels').children).map(el =>
    '• ' + el.textContent.trim().replace(/\s+/g, ' ')
).join('\n')}

*Цена ликвидации:* ${liquidationPriceSpan.textContent}

*Расчет позиции:*
Риск = ${riskAmount.toFixed(8)} USDT
Разница цены = ${priceDifference.toFixed(8)} USDT
Размер позиции = ${riskAmount.toFixed(8)} / ${priceDifference.toFixed(8)} = ${formatNumber(positionSize)}

#${isLong ? 'Long' : 'Short'} #${tradeType.replace('-', '')} #RiskManagement
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
