const { contextBridge, ipcRenderer } = require("electron");

const APP_API = {
	callSync: (fn) => ipcRenderer.sendSync(fn),
	call: (fna, args, fnb, cb) => {
		ipcRenderer.send(fna, args);
		let listener = (_event, _args) => {
			ipcRenderer.removeListener(fnb, listener);
			cb(_event, _args);
		};
		ipcRenderer.on(fnb, listener);
	},
	removeAllListeners: (n) => ipcRenderer.removeAllListeners(n),
	send: (a, b) => ipcRenderer.send(a, b),
	on: (a, b) => ipcRenderer.on(a, b)
}

contextBridge.exposeInMainWorld("api", APP_API);