import { runAdminGlobalStructureTests } from "./admin-global-structures.test";
import { runCandidatePublicTests } from "./candidate-public.test";
import { runElectionDayTests } from "./election-day.test";
import { runPhase1ArchitectureTests } from "./phase1-architecture.test";
import { runPreElectionTests } from "./pre-election.test";

void (async () => {
  await runAdminGlobalStructureTests();
  await runCandidatePublicTests();
  await runElectionDayTests();
  await runPhase1ArchitectureTests();
  await runPreElectionTests();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
