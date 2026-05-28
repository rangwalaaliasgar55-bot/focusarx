module.exports = (req, res) => import('../artifacts/api-server/dist/index.mjs').then(m => m.default(req, res));
