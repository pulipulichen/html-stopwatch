import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',use:{baseURL:'http://127.0.0.1:4173/html-stopwatch/',browserName:'chromium'},
 webServer:{command:'python3 -m http.server 4173 --directory /tmp/stopwatch-test',url:'http://127.0.0.1:4173/html-stopwatch/',reuseExistingServer:false},
 reporter:'list'
});
