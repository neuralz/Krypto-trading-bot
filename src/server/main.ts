const packageConfig = require("./../../package.json");

const noop = () => {};
const bindings = ((K) => { try {
  console.log(K.join('.'));
  return require('./lib/'+K.join('.'));
} catch (e) {
  if (process.version.substring(1).split('.').map((n) => parseInt(n))[0] < 7)
    throw new Error('K requires Node.js v7.0.0 or greater.');
  else throw new Error(e);
}})([packageConfig.name[0], process.platform, process.versions.modules]);
bindings.uiLoop(noop);

import request = require('request');

import Broker = require("./broker");
import QuoteSender = require("./quote-sender");
import Models = require("../share/models");
import Safety = require("./safety");
import PositionManagement = require("./position-management");
import Statistics = require("./statistics");
import QuotingEngine = require("./quoting-engine");

let happyEnding = () => { console.info(new Date().toISOString().slice(11, -1), 'main', 'Error', 'THE END IS NEVER '.repeat(21)+'THE END'); };

const processExit = () => {
  happyEnding();
  setTimeout(process.exit, 2000);
};

process.on("uncaughtException", err => {
  console.error(new Date().toISOString().slice(11, -1), 'main', 'Unhandled exception!', err);
  processExit();
});

process.on("unhandledRejection", (reason, p) => {
  console.error(new Date().toISOString().slice(11, -1), 'main', 'Unhandled rejection!', reason, p);
  processExit();
});

process.on("SIGINT", () => {
  process.stdout.write("\n"+new Date().toISOString().slice(11, -1)+' main Excellent decision! ');
  request({url: 'https://api.icndb.com/jokes/random?escape=javascript&limitTo=[nerdy]',json: true,timeout:3000}, (err, resp, body) => {
    if (!err && resp.statusCode === 200) process.stdout.write(body.value.joke);
    process.stdout.write("\n");
    processExit();
  });
});

process.on("exit", (code) => {
  console.info(new Date().toISOString().slice(11, -1), 'main', 'Exit code', code);
});

const positionBroker = new Broker.PositionBroker(
  bindings.qpRepo,
  bindings.cfmCurrencyPair(),
  bindings.gwExchange(),
  bindings.allOrders,
  bindings.mgFairV,
  bindings.uiSnap,
  bindings.uiSend,
  bindings.evOn,
  bindings.evUp
);

const quotingEngine = new QuotingEngine.QuotingEngine(
  bindings.mgFairV,
  bindings.mgFilter,
  bindings.qpRepo,
  positionBroker,
  bindings.gwMinTick(),
  bindings.gwMinSize(),
  new Statistics.EWMAProtectionCalculator(
    bindings.mgFairV,
    bindings.qpRepo,
    bindings.evUp
  ),
  new Statistics.STDEVProtectionCalculator(
    bindings.mgFairV,
    bindings.mgFilter,
    bindings.qpRepo,
    bindings.dbInsert,
    bindings.computeStdevs,
    bindings.dbLoad(Models.Topics.MarketData)
  ),
  new PositionManagement.TargetBasePositionManager(
    bindings.gwMinTick(),
    bindings.dbInsert,
    bindings.mgFairV,
    new Statistics.EWMATargetPositionCalculator(
      bindings.qpRepo,
      bindings.dbLoad(Models.Topics.EWMAChart)
    ),
    bindings.qpRepo,
    positionBroker,
    bindings.uiSnap,
    bindings.uiSend,
    bindings.evOn,
    bindings.evUp,
    bindings.dbLoad(Models.Topics.TargetBasePosition)
  ),
  new Safety.SafetyCalculator(
    bindings.mgFairV,
    bindings.qpRepo,
    positionBroker,
    bindings.tradesMemory,
    bindings.uiSnap,
    bindings.uiSend,
    bindings.evOn,
    bindings.evUp
  ),
  bindings.evOn,
  bindings.evUp
);

new QuoteSender.QuoteSender(
  quotingEngine,
  bindings.allOrders,
  bindings.allOrdersDelete,
  bindings.cancelOrder,
  bindings.sendOrder,
  bindings.gwMinTick(),
  bindings.qpRepo,
  bindings.uiSnap,
  bindings.uiSend,
  bindings.evOn
);

happyEnding = () => {
  bindings.cancelOpenOrders();
  console.info(new Date().toISOString().slice(11, -1), 'main', 'Attempting to cancel all open orders, please wait..');
};

let highTime = process.hrtime();
setInterval(() => {
  const diff = process.hrtime(highTime);
  const n = ((diff[0] * 1e9 + diff[1]) / 1e6) - 500;
  if (n > 242) console.info(new Date().toISOString().slice(11, -1), 'main', 'Event loop delay', (Math.floor(n/100)*100) + 'ms');
  highTime = process.hrtime();
}, 500).unref();
