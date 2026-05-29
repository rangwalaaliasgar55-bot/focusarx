let appPromise = null;

module.exports = async (req, res) => {
  if (!appPromise) {
    appPromise = import('../artifacts/api-server/dist/index.mjs').then(m => m.default);
  }
  const app = await appPromise;
  app(req, res);
};
