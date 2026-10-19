// No seu app.js:   require('./src/routes')(app, { auth: SEU_MIDDLEWARE_DE_AUTH });
const { errorHandler } = require('../lib/http');

module.exports = (app, { auth }) => {
  app.use('/webhooks', require('./webhooks'));            // sem login (validado por segredo)
  app.use('/jobs', require('./jobs'));                    // sem login (validado por CRON_SECRET)
  app.use('/api', auth, require('./api'));
  app.use(['/api', '/webhooks', '/jobs'], errorHandler);
};
