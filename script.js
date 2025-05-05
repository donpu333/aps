// Состояние приложения
const state = {
    currentUser: null,
    settings: {},
    pageCache: {}
};

// DOM элементы
const navContainer = document.getElementById('navContainer');
const authLinks = document.getElementById('authLinks');
const userInfo = document.getElementById('userInfo');
const userEmail = document.getElementById('userEmail');

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем авторизацию в localStorage
    const savedUser = localStorage.getItem('cryptoAppUser');
    const savedSettings = localStorage.getItem('cryptoAppSettings');

    if (savedUser) {
        state.currentUser = JSON.parse(savedUser);
        if (savedSettings) {
            state.settings = JSON.parse(savedSettings);
        }
        updateUI();
    }

    // Загружаем начальную страницу
    const initialPage = state.currentUser ? state.settings.lastPage || 'calculator' : 'calculator';
    loadPage(initialPage);

    // Проверяем "Запомнить меня"
    checkRememberMe();
});

// Функции для работы с модальными окнами
function showModal(id) {
    document.getElementById(id).style.display = 'block';
    // Очищаем сообщения при открытии
    if (id === 'registerModal') {
        document.getElementById('registerError').textContent = '';
        document.getElementById('registerSuccess').textContent = '';
        document.getElementById('registerForm').reset();
    } else if (id === 'loginModal') {
        document.getElementById('loginError').textContent = '';
        document.getElementById('loginForm').reset();
    } else if (id === 'forgotPasswordModal') {
        document.getElementById('forgotError').textContent = '';
        document.getElementById('forgotSuccess').textContent = '';
        document.getElementById('forgotPasswordForm').reset();
    }
}

function hideModal(id) {
    document.getElementById(id).style.display = 'none';
}

function showForgotPassword() {
    hideModal('loginModal');
    showModal('forgotPasswordModal');
}

// Хеширование пароля (упрощенное для демонстрации)
function hashPassword(password) {
    return btoa(unescape(encodeURIComponent(password))); // В реальном приложении используйте более надежное хеширование
}

// Регистрация нового пользователя
function register() {
    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const errorElement = document.getElementById('registerError');
    const successElement = document.getElementById('registerSuccess');

    // Валидация
    if (!username || !email || !password || !confirmPassword) {
        errorElement.textContent = 'Все поля обязательны для заполнения';
        return;
    }

    if (password !== confirmPassword) {
        errorElement.textContent = 'Пароли не совпадают';
        return;
    }

    if (password.length < 6) {
        errorElement.textContent = 'Пароль должен содержать минимум 6 символов';
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errorElement.textContent = 'Введите корректный email';
        return;
    }

    // Проверяем, есть ли уже такой пользователь
    const users = JSON.parse(localStorage.getItem('cryptoAppUsers')) || {};
    if (users[email]) {
        errorElement.textContent = 'Пользователь с таким email уже существует';
        return;
    }

    // Регистрируем пользователя
    users[email] = {
        username,
        email,
        password: hashPassword(password),
        createdAt: new Date().toISOString(),
        isVerified: false,
        verifyToken: Math.random().toString(36).substring(2, 15)
    };
    localStorage.setItem('cryptoAppUsers', JSON.stringify(users));

    // Показываем сообщение об успехе
    errorElement.textContent = '';
    successElement.textContent = 'Регистрация прошла успешно!';

    // Автоматически входим через 1.5 секунды
    setTimeout(() => {
        state.currentUser = { username, email };
        localStorage.setItem('cryptoAppUser', JSON.stringify(state.currentUser));

        // Создаем настройки по умолчанию
        state.settings = {
            theme: 'dark',
            lastPage: 'calculator',
            alerts: []
        };
        localStorage.setItem('cryptoAppSettings', JSON.stringify(state.settings));

        updateUI();
        hideModal('registerModal');
        loadPage(state.settings.lastPage);
    }, 1500);
}

// Вход пользователя
function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('rememberMe').checked;
    const errorElement = document.getElementById('loginError');

    // Проверяем пользователя
    const users = JSON.parse(localStorage.getItem('cryptoAppUsers')) || {};
    const user = users[email];

    if (!user || user.password !== hashPassword(password)) {
        errorElement.textContent = 'Неверный email или пароль';
        return;
    }

    if (!user.isVerified) {
        errorElement.textContent = 'Подтвердите почту!';
        return;
    }

    // Входим
    state.currentUser = { username: user.username, email };
    localStorage.setItem('cryptoAppUser', JSON.stringify(state.currentUser));

    // Загружаем настройки
    const allSettings = JSON.parse(localStorage.getItem('cryptoAppAllSettings')) || {};
    state.settings = allSettings[email] || {
        theme: 'dark',
        lastPage: 'calculator',
        alerts: []
    };

    if (remember) {
        const rememberToken = Math.random().toString(36).substring(2, 15);
        user.rememberToken = hashPassword(rememberToken);
        localStorage.setItem('cryptoAppUsers', JSON.stringify(users));

        // Устанавливаем куку на 30 дней
        const date = new Date();
        date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000));
        document.cookie = `remember=${rememberToken}; expires=${date.toUTCString()}; path=/`;
    }

    updateUI();
    hideModal('loginModal');
    loadPage(state.settings.lastPage);
}

// Отправка ссылки для сброса пароля
function sendResetLink() {
    const email = document.getElementById('forgotEmail').value.trim();
    const errorElement = document.getElementById('forgotError');
    const successElement = document.getElementById('forgotSuccess');

    if (!email) {
        errorElement.textContent = 'Введите email';
        return;
    }

    // Проверяем существование пользователя
    const users = JSON.parse(localStorage.getItem('cryptoAppUsers')) || {};
    const user = users[email];

    if (!user) {
        errorElement.textContent = 'Пользователь с таким email не найден';
        return;
    }

    // Генерируем токен сброса
    user.resetToken = Math.random().toString(36).substring(2, 15);
    user.resetTokenExpires = new Date(Date.now() + 3600000).toISOString(); // 1 час
    localStorage.setItem('cryptoAppUsers', JSON.stringify(users));

    errorElement.textContent = '';
    successElement.textContent = 'Ссылка для сброса пароля отправлена на ваш email';

    console.log(`Ссылка для сброса пароля: https://yourdomain.com/reset_password.html?token=${user.resetToken}&email=${encodeURIComponent(email)}`);
}

// Выход пользователя
function logout() {
    state.currentUser = null;
    localStorage.removeItem('cryptoAppUser');

    // Удаляем куку "Запомнить меня"
    document.cookie = 'remember=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    updateUI();
    loadPage('calculator');
}

// Обновление интерфейса
function updateUI() {
    if (state.currentUser) {
        authLinks.style.display = 'none';
        userInfo.style.display = 'flex';
        userEmail.textContent = state.currentUser.username || state.currentUser.email;

        // Применяем настройки
        document.body.style.backgroundColor = state.settings.theme === 'dark' ? '#121212' : '#f5f5f5';
        document.body.style.color = state.settings.theme === 'dark' ? '#ffffff' : '#000000';
    } else {
        authLinks.style.display = 'flex';
        userInfo.style.display = 'none';
    }
}

// Загрузка страницы
function loadPage(page) {
    // Скрываем все вкладки
    document.querySelectorAll('.tab-pane').forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
    });

    // Показываем выбранную вкладку
    const activeTab = document.getElementById(page);
    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.style.display = 'block';

        // Загружаем контент, если он еще не загружен
        if (!state.pageCache[page] && activeTab.innerHTML.trim() === '<div class="loader">Загрузка...</div>') {
            fetch(`${page}.html`)
                .then(response => {
                    if (!response.ok) throw new Error('Страница не найдена');
                    return response.text();
                })
                .then(html => {
                    activeTab.innerHTML = html;
                    state.pageCache[page] = html;
                })
                .catch(error => {
                    activeTab.innerHTML = `<div class="error">Не удалось загрузить страницу: ${error.message}</div>`;
                });
        } else if (state.pageCache[page]) {
            activeTab.innerHTML = state.pageCache[page];
        }
    }

    // Сворачиваем меню
    navContainer.classList.remove('expanded');

    // Сохраняем последнюю страницу в настройках
    if (state.currentUser) {
        state.settings.lastPage = page;
        const allSettings = JSON.parse(localStorage.getItem('cryptoAppAllSettings')) || {};
        allSettings[state.currentUser.email] = state.settings;
        localStorage.setItem('cryptoAppAllSettings', JSON.stringify(allSettings));
    }
}

// Открытие/закрытие меню по клику
navContainer.addEventListener('click', function(e) {
    if (e.target === navContainer) {
        navContainer.classList.toggle('expanded');
    }
});

// Закрытие модальных окон при клике вне их области
window.addEventListener('click', function(event) {
    if (event.target.className === 'modal') {
        event.target.style.display = 'none';
    }
});

// Проверка куки "Запомнить меня" при загрузке
function checkRememberMe() {
    const cookies = document.cookie.split(';');
    let rememberToken = null;

    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'remember') {
            rememberToken = value;
            break;
        }
    }

    if (rememberToken) {
        const users = JSON.parse(localStorage.getItem('cryptoAppUsers')) || {};

        for (const email in users) {
            const user = users[email];
            if (user.rememberToken && user.rememberToken === hashPassword(rememberToken)) {
                state.currentUser = { username: user.username, email };
                localStorage.setItem('cryptoAppUser', JSON.stringify(state.currentUser));

                // Загружаем настройки
                const allSettings = JSON.parse(localStorage.getItem('cryptoAppAllSettings')) || {};
                state.settings = allSettings[email] || {
                    theme: 'dark',
                    lastPage: 'calculator',
                    alerts: []
                };

                updateUI();
                loadPage(state.settings.lastPage);
                break;
            }
        }
    }
}

