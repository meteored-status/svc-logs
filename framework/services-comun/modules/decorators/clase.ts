export function addGetters() {
    return function <T extends { new (...args: any[]): {} }>(constructor: T) {
        return class extends constructor {
            constructor(...args: any[]) {
                super(...args);
                const [data] = args;
                if (typeof data === 'object') {
                    for (const key in data) {
                        if (data.hasOwnProperty(key)) {
                            Object.defineProperty(this, key, {
                                get: function () {
                                    return data[key];
                                },
                                enumerable: true,
                                configurable: true,
                            });
                        }
                    }
                }
            }
        };
    };
}
