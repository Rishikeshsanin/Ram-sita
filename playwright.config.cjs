const {defineConfig, devices} = require('@playwright/test');
module.exports = defineConfig({
  testDir: './browser',
  timeout: 90000,
  expect: {timeout: 12000},
  fullyParallel: false,
  retries: 1,
  reporter: 'list',
  use: {...devices['Desktop Chrome'], baseURL:'http://127.0.0.1:3000', trace:'retain-on-failure', screenshot:'only-on-failure'},
  webServer: {command:'npm start', url:'http://127.0.0.1:3000/health', reuseExistingServer:!process.env.CI, timeout:40000}
});
