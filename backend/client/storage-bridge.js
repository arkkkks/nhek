(function () {
    if (window.__portalStorageBridgeInstalled) {
        return;
    }
    window.__portalStorageBridgeInstalled = true;

    if (location.protocol === "file:") {
        return;
    }

    const native = {
        getItem: Storage.prototype.getItem,
        setItem: Storage.prototype.setItem,
        removeItem: Storage.prototype.removeItem,
        clear: Storage.prototype.clear,
        key: Storage.prototype.key
    };

    function syncRequest(method, url, body) {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, false);
        xhr.setRequestHeader("Content-Type", "application/json");
        try {
            xhr.send(body ? JSON.stringify(body) : null);
        } catch (error) {
            throw new Error("Storage bridge request failed");
        }
        if (xhr.status < 200 || xhr.status >= 300) {
            throw new Error("Storage bridge HTTP " + xhr.status);
        }
        if (!xhr.responseText) return {};
        try {
            return JSON.parse(xhr.responseText);
        } catch (error) {
            return {};
        }
    }

    function snapshot(storageObj) {
        const out = {};
        const len = storageObj.length;
        for (let i = 0; i < len; i += 1) {
            const key = native.key.call(storageObj, i);
            if (key == null) continue;
            out[key] = native.getItem.call(storageObj, key);
        }
        return out;
    }

    const cache = {
        local: new Map(),
        session: new Map()
    };

    function replaceCache(scope, items) {
        const map = cache[scope];
        map.clear();
        Object.keys(items || {}).forEach((key) => {
            map.set(key, String(items[key]));
        });
    }

    function migrateNativeToServer(scope, nativeItems, serverItems) {
        if (!nativeItems || !Object.keys(nativeItems).length) {
            return;
        }
        if (serverItems && Object.keys(serverItems).length) {
            return;
        }
        Object.keys(nativeItems).forEach((key) => {
            syncRequest("PUT", `/api/storage?scope=${scope}`, { key, value: nativeItems[key] });
        });
    }

    let bridgeReady = false;
    try {
        const nativeLocal = snapshot(window.localStorage);
        const nativeSession = snapshot(window.sessionStorage);

        const localResponse = syncRequest("GET", "/api/storage?scope=local");
        const sessionResponse = syncRequest("GET", "/api/storage?scope=session");

        migrateNativeToServer("local", nativeLocal, localResponse.items);
        migrateNativeToServer("session", nativeSession, sessionResponse.items);

        const finalLocal = syncRequest("GET", "/api/storage?scope=local");
        const finalSession = syncRequest("GET", "/api/storage?scope=session");
        replaceCache("local", finalLocal.items || {});
        replaceCache("session", finalSession.items || {});

        native.clear.call(window.localStorage);
        native.clear.call(window.sessionStorage);
        bridgeReady = true;
    } catch (error) {
        console.warn("Storage bridge disabled:", error.message);
        return;
    }

    function getScope(storageInstance) {
        return storageInstance === window.sessionStorage ? "session" : "local";
    }

    function getMap(storageInstance) {
        return cache[getScope(storageInstance)];
    }

    Storage.prototype.getItem = function getItem(key) {
        if (!bridgeReady) return native.getItem.call(this, key);
        const map = getMap(this);
        const normalizedKey = String(key);
        return map.has(normalizedKey) ? map.get(normalizedKey) : null;
    };

    Storage.prototype.setItem = function setItem(key, value) {
        if (!bridgeReady) return native.setItem.call(this, key, value);
        const scope = getScope(this);
        const map = getMap(this);
        const normalizedKey = String(key);
        const normalizedValue = String(value);
        map.set(normalizedKey, normalizedValue);
        syncRequest("PUT", `/api/storage?scope=${scope}`, { key: normalizedKey, value: normalizedValue });
    };

    Storage.prototype.removeItem = function removeItem(key) {
        if (!bridgeReady) return native.removeItem.call(this, key);
        const scope = getScope(this);
        const map = getMap(this);
        const normalizedKey = String(key);
        map.delete(normalizedKey);
        syncRequest("DELETE", `/api/storage?scope=${scope}&key=${encodeURIComponent(normalizedKey)}`);
    };

    Storage.prototype.clear = function clear() {
        if (!bridgeReady) return native.clear.call(this);
        const scope = getScope(this);
        const map = getMap(this);
        map.clear();
        syncRequest("DELETE", `/api/storage?scope=${scope}`);
    };

    Storage.prototype.key = function key(index) {
        if (!bridgeReady) return native.key.call(this, index);
        const map = getMap(this);
        const keys = Array.from(map.keys());
        const i = Number(index);
        if (!Number.isInteger(i) || i < 0 || i >= keys.length) {
            return null;
        }
        return keys[i];
    };

    Object.defineProperty(Storage.prototype, "length", {
        configurable: true,
        enumerable: true,
        get: function getLength() {
            if (!bridgeReady) return 0;
            return getMap(this).size;
        }
    });
})();
