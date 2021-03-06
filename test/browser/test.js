#!/usr/bin/env node

'use strict';

var wd = require('wd');
var sauceConnectLauncher = require('sauce-connect-launcher');
var selenium = require('selenium-standalone');
var querystring = require('querystring');

var server = require('./server.js');

var testTimeout = 30 * 60 * 1000;

var username = process.env.SAUCE_USERNAME;
var accessKey = process.env.SAUCE_ACCESS_KEY;

// process.env.CLIENT is a colon seperated list of
// (saucelabs|selenium):browserName:browserVerion:platform
var tmp = (process.env.CLIENT || 'selenium:firefox').split(':');
var client = {
  runner: tmp[0] || 'selenium',
  browser: tmp[1] || 'firefox',
  version: tmp[2] || null, // Latest
  platform: tmp[3] || null
};

var testUrl = 'http://127.0.0.1:8001/test/index.html';
var qs = {};

var sauceClient;
var sauceConnectProcess;
var tunnelId = process.env.TRAVIS_JOB_NUMBER || 'tunnel-' + Date.now();

if (client.runner === 'saucelabs') {
  qs.saucelabs = true;
}
if (process.env.GREP) {
  qs.grep = process.env.GREP;
}
testUrl += '?';
testUrl += querystring.stringify(qs);

if (process.env.TRAVIS &&
  client.browser !== 'firefox' &&
  client.browser !== 'phantomjs' &&
  client.browser !== 'chrome' &&
  process.env.TRAVIS_SECURE_ENV_VARS === 'false') {
  console.error('Not running test, cannot connect to saucelabs');
  process.exit(1);
  return;
}

function testError(e) {
  console.error(e);
  console.error('Doh, tests failed');
  sauceClient.quit();
  process.exit(3);
}

function postResult(result) {
  console.log('postResult');
  process.exit(!process.env.PERF && result.failed ? 1 : 0);
}

function testComplete(result) {
  console.log('testComplete1');
  console.log(result);
  console.log('testComplete2');

  sauceClient.quit().then(function () {
    if (sauceConnectProcess) {
      sauceConnectProcess.close(function () {
        postResult(result);
      });
    } else {
      postResult(result);
    }
  });
}

function startSelenium(callback) {
  // Start selenium
  var opts = {
    version: '2.45.0'
  };
  console.log('startSelenium1');
  selenium.install(opts, function (err) {
    console.log('startSelenium2');
    if (err) {
      console.error('Failed to install selenium');
      process.exit(1);
    }
    selenium.start(opts, function ( /* err, server */ ) {
      console.log('startSelenium3');
      sauceClient = wd.promiseChainRemote();
      callback();
    });
  });
}

function startSauceConnect(callback) {

  var options = {
    username: username,
    accessKey: accessKey,
    tunnelIdentifier: tunnelId
  };

  console.log('startSauceConnect1');
  sauceConnectLauncher(options, function (err, process) {
    if (err) {
      console.error('Failed to connect to saucelabs');
      console.error(err);
      return process.exit(1);
    }
    console.log('startSauceConnect2');

    sauceConnectProcess = process;
    sauceClient = wd.promiseChainRemote('localhost', 4445, username, accessKey);
    callback();
  });
}

function startTest() {

  console.log('Starting', client);

  console.log('tunnelId=', tunnelId);

  var opts = {
    browserName: client.browser,
    version: client.version,
    platform: client.platform,
    tunnelTimeout: testTimeout,
    name: client.browser + ' - ' + tunnelId,
    'max-duration': 60 * 30,
    'command-timeout': 599,
    'idle-timeout': 599,
    'tunnel-identifier': tunnelId
  };

  console.log('testUrl=', testUrl);
  sauceClient.init(opts).get(testUrl, function () {

    /* jshint evil: true */
    var interval = setInterval(function () {
      console.log('startTest1');

      sauceClient.eval('window.results', function (err, results) {
        console.log('startTest2', err, results);
        console.log('startTest2a');

        if (err) {
          console.log('startTest3');
          clearInterval(interval);
          testError(err);
        } else if (results.completed || results.failures.length) {
          console.log('startTest4');
          clearInterval(interval);
          testComplete(results);
        } else {
          console.log('startTest5');
          console.log('=> ', results);
        }
        console.log('startTest6');

      });
    }, 10 * 1000);
  });
}

server.start(function () {
  if (client.runner === 'saucelabs') {
    startSauceConnect(startTest);
  } else {
    startSelenium(startTest);
  }
});
