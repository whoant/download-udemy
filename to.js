module.exports = promise => {
    return promise.then(data => [null, data]).catch(err => [err]);
};
