import { runWorkerDerivativeTests } from "./derivatives.test";

void (async () => {
  await runWorkerDerivativeTests();
  console.log("worker_tests=passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
