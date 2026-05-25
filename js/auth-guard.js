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

function joinPath(base, target) {
    if (!base) {
        return target;
    }
    if (base.endsWith('/')) {
        return `${base}${target}`;
    }
    return `${base}/${target}`;
}

(function guard() {
    const script = document.currentScript;
    const roles = script && script.dataset.roles
        ? script.dataset.roles.split(',').map((role) => role.trim()).filter(Boolean)
        : [];
    const loginUrl = script && script.dataset.login ? script.dataset.login : '../login.html';
    const root = script && script.dataset.root ? script.dataset.root : '../';
    const session = readSession();

    const logout = () => {
        localStorage.removeItem(SESSION_KEY);
        window.location.replace(loginUrl);
    };
    window.appLogout = logout;

    if (!session) {
        window.location.replace(loginUrl);
        return;
    }

    if (roles.length && !roles.includes(session.role)) {
        const target = session.home ? joinPath(root, session.home) : loginUrl;
        window.location.replace(target);
    }
})();
