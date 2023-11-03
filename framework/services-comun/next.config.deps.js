const base = require('./next.config.base');

if (base.webpack!==undefined) {
    delete base.webpack;
}

module.exports = function (custom) {
    return {
        ...base,
        ...custom,
    };
};
