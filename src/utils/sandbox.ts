const BLOCKED_GLOBALS = [
    "eval",
    "Function",
    "XMLHttpRequest",
    "WebSocket",
    "fetch",
    "document",
    "window",
    "Worker",
    "SharedWorker",
    "ServiceWorker",
    "process",
    "require",
    "module",
    "exports",
    "__dirname",
    "__filename",
    "indexedDB",
    "IDBFactory",
    "IDBDatabase",
    "IDBRequest",
];

function createWorkerCode(inject?: string): string {
    return `
        (function() {
            const blockAndLock = (obj, prop) => {
                try {
                    Object.defineProperty(obj, prop, {
                        get: () => { throw new Error("SecurityError: Access to " + prop + " is blocked."); },
                        configurable: false,
                        enumerable: false
                    });
                } catch (error) {
                    try { obj[prop] = undefined; } catch (innerError) {}
                }
            };

            const targets = [self, WorkerGlobalScope.prototype, EventTarget.prototype];
            const blockList = ${JSON.stringify(BLOCKED_GLOBALS)};

            targets.forEach(target => {
                if (!target) return;
                blockList.forEach(api => {
                    if (api in target) blockAndLock(target, api);
                });
            });

            try {
                const noOp = () => { throw new Error("SecurityError: Dynamic execution is blocked."); };
                self.constructor.constructor = noOp;
                (async function(){}).constructor.constructor = noOp;
            } catch (error) {
                console.warn("Failed to lock down Function constructor:", error);
            }
        })();
        ${inject ?? ""}
        self.onmessage = async function(event) {
            const { code, args } = event.data;
            try {
                const blob = new Blob([code], { type: 'application/javascript' });
                const url = URL.createObjectURL(blob);

                try {
                    const userModule = await import(url);
                    const renderFn = userModule.default;
                    if (typeof renderFn !== 'function') {
                        throw new Error('Must export default a function');
                    }

                    const result = await renderFn(...args);
                    self.postMessage({ success: true, result });
                } finally {
                    URL.revokeObjectURL(url);
                }
            } catch (error) {
                self.postMessage({
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        };
    `;
}

export default function createSandBox(inject?: string) {
    let worker: Worker | null = null;
    const workerCode = createWorkerCode(inject);
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);

    const initWorker = () => {
        if (!worker) {
            worker = new Worker(workerUrl, { type: "module" });
        }
        return worker;
    };

    return {
        runDefaultExport: async (
            code: string,
            args: unknown[],
            timeout = 5000,
        ): Promise<unknown> => {
            return new Promise((resolve, reject) => {
                const runningWorker = initWorker();
                const timeoutId = window.setTimeout(() => {
                    reject(
                        new Error(
                            `Timeout: code running time exceeded ${timeout}ms`,
                        ),
                    );
                    runningWorker.terminate();
                    worker = null;
                }, timeout);

                runningWorker.onmessage = (event) => {
                    clearTimeout(timeoutId);
                    if (event.data.success) {
                        resolve(event.data.result);
                        return;
                    }
                    reject(new Error(event.data.error));
                };

                runningWorker.postMessage({ code, args });
            });
        },
        destroy: () => {
            if (worker) {
                worker.terminate();
                worker = null;
            }
            URL.revokeObjectURL(workerUrl);
        },
    };
}
