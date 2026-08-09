import { runAdminGlobalStructureTests } from "./admin-global-structures.test";
import { runCandidatePublicTests } from "./candidate-public.test";
import { runPhase1ArchitectureTests } from "./phase1-architecture.test";

void (async () => {
  await runAdminGlobalStructureTests();
  await runCandidatePublicTests();
  await runPhase1ArchitectureTests();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
