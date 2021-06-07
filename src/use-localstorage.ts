"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const local_storage_events_1 = require("./local-storage-events");
const react_1 = require("react");
function tryParse(value) {
    try {
        return JSON.parse(value);
    }
    catch (_a) {
        return value;
    }
}
function useLocalStorage(key, initialValue) {
    const [localState, updateLocalState] = react_1.useState(localStorage.getItem(key) === null ? initialValue : tryParse(localStorage.getItem(key)));
    const onLocalStorageChange = (event) => {
        if (local_storage_events_1.isTypeOfLocalStorageChanged(event)) {
            if (event.detail.key === key) {
                updateLocalState(event.detail.value);
            }
        }
        else {
            if (event.key === key) {
                if (event.newValue) {
                    updateLocalState(tryParse(event.newValue));
                }
            }
        }
    };
    // when the key changes, update localState to reflect it.
    react_1.useEffect(() => {
        updateLocalState(localStorage.getItem(key) === null ? initialValue : tryParse(localStorage.getItem(key)));
    }, [key]);
    react_1.useEffect(() => {
        // The custom storage event allows us to update our component
        // when a change occurs in localStorage outside of our component
        const listener = (e) => onLocalStorageChange(e);
        window.addEventListener(local_storage_events_1.LocalStorageChanged.eventName, listener);
        // The storage event only works in the context of other documents (eg. other browser tabs)
        window.addEventListener('storage', listener);
        const canWrite = localStorage.getItem(key) === null;
        // Write initial value to the local storage if it's not present or contains invalid JSON data.
        if (initialValue !== undefined && canWrite) {
            local_storage_events_1.writeStorage(key, initialValue);
        }
        return () => {
            window.removeEventListener(local_storage_events_1.LocalStorageChanged.eventName, listener);
            window.removeEventListener('storage', listener);
        };
    }, [key]);
    const writeState = react_1.useCallback((value) => local_storage_events_1.writeStorage(key, value), [key]);
    const deleteState = react_1.useCallback(() => local_storage_events_1.deleteFromStorage(key), [key]);
    return [localState === null ? initialValue : localState, writeState, deleteState];
}
exports.useLocalStorage = useLocalStorage;
//# sourceMappingURL=use-localstorage.js.map