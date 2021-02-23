import Chalk from "chalk";

const Pkg = require("../package.json"); // eslint-disable-line
const caught = Chalk.cyan("caught");

export const ErrorCommon = {
  fileIssue: Chalk.green(`
    If you have followed this resolution step and you are still seeing an
    error, please file an issue on the electrode-server repository

    ${Pkg.repository.url}
  `),
  errContext: `${Pkg.name} ${caught} an error while starting your server`
};
