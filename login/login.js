const SESSION_KEY = 'appSession';

function readSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) {
            return null;
        }
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') {
            return null;
        }
        return data;
    } catch (error) {
        return null;
    }
}

function writeSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function loadUsers() {
    const response = await fetch('users.json', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error('No se pudo cargar users.json');
    }
    return response.json();
}

function setError(message) {
    const error = document.getElementById('login-error');
    error.textContent = message;
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const basePath = document.body.dataset.root || './';
    let usersCache = null;

    const session = readSession();
    if (session && session.home) {
        window.location.href = `${basePath}${session.home}`;
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setError('');

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            setError('Completa usuario y contrasena.');
            return;
        }

        try {
            const users = usersCache || await loadUsers();
            usersCache = users;

            const user = users.find((item) => item.username === username && item.password === password);
            if (!user) {
                setError('Credenciales invalidas.');
                return;
            }

            writeSession({
                username: user.username,
                role: user.role,
                displayName: user.displayName,
                home: user.home,
                loggedAt: new Date().toISOString()
            });

            window.location.href = `${basePath}${user.home}`;
        } catch (error) {
            setError('No se pudo validar el usuario.');
        }
    });
});
