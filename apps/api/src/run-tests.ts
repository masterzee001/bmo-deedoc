import { runAdminGlobalStructureTests } from "./admin-global-structures.test";

void runAdminGlobalStructureTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
