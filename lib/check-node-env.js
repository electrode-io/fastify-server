"use strict";

const Chalk = require("chalk");

function checkNodeEnv() {
  const allowed = ["qa", "development", "staging", "production", "test"];

  if (process.env.NODE_ENV && !allowed.includes(process.env.NODE_ENV)) {
    const msg = `Electrode Server Notice: NODE_ENV (${process.env.NODE_ENV}) should be empty or one of ${allowed}`; // eslint-disable-line
    process.stderr.write(`    ${Chalk.inverse.bold.yellow(msg)}\n`);
  }
  return;
}

module.exports = checkNodeEnv;
