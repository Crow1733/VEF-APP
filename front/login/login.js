const SESSION_KEY = 'appSession';

const ROLE_HOME = {
    admin: 'Administrador/administrador-manager.html',
    cajero: 'Caja/caja-manager.html'
};

function readSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return (data && typeof data === 'object') ? data : null;
    } catch (error) {
        return null;
    }
}

function writeSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function setError(message) {
    document.getElementById('login-error').textContent = message;
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const basePath = document.body.dataset.root || './';

    const session = readSession();
    if (session && session.home) {
        window.location.href = `${basePath}${session.home}`;
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setError('');

        const usuario = document.getElementById('username').value.trim();
        const clave = document.getElementById('password').value;

        if (!usuario || !clave) {
            setError('Completa usuario y contraseña.');
            return;
        }

        try {
            const user = await window.api.usuarios.autenticar(usuario, clave);
            if (!user) {
                setError('Credenciales inválidas.');
                return;
            }

            const home = ROLE_HOME[user.rol] || ROLE_HOME.cajero;
            writeSession({
                id: user.id,
                username: user.usuario,
                role: user.rol,
                displayName: user.nombre,
                home,
                loggedAt: new Date().toISOString()
            });

            window.location.href = `${basePath}${home}`;
        } catch (error) {
            setError('No se pudo validar el usuario.');
        }
    });
});
