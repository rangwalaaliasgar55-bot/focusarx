import('../artifacts/api-server/dist/index.mjs').catch((err) => {
  console.error('Failed to load API server:', err);
  process.exit(1);
});
