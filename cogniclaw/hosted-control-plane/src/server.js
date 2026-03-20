require('dotenv').config();

const { createApp } = require('./app');
const { config } = require('./config/env');
const logger = require('./lib/logger');

const app = createApp();

app.listen(config.port, () => {
  logger.info('control-plane.started', {
    port: config.port,
    env: config.appEnv,
    dataFile: config.dataFile
  });
});
