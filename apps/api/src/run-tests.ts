import { runAdminGlobalStructureTests } from "./admin-global-structures.test";
import { runCandidatePublicTests } from "./candidate-public.test";

void (async () => {
  await runAdminGlobalStructureTests();
  await runCandidatePublicTests();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
