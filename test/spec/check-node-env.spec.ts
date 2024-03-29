/* eslint-disable */
import { checkNodeEnv } from "../../src/check-node-env";

describe("process-env-abbr", function () {
  let saveEnv;

  beforeEach(() => {
    saveEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (saveEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = saveEnv;
    }
  });

  it("should do nothing for empty NODE_ENV", function () {
    process.env.NODE_ENV = "";
    checkNodeEnv();
  });

  it("should do nothing for full NODE_ENV", function () {
    ["production", "staging", "development"].forEach(x => {
      process.env.NODE_ENV = x;
      checkNodeEnv();
    });
  });

  it("should print warning for unexpected NODE_ENV", function () {
    const w = process.stderr.write;
    let msg;
    process.stderr.write = (m => {
      msg = m;
    }) as any;
    process.env.NODE_ENV = "undefined";
    checkNodeEnv();
    process.stderr.write = w;
    expect(msg).toMatch("should be empty or one of");
  });
});
