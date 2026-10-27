// These are the same post-build checks that the pinned rer verify runs.
import { checkHostedOutput } from '@runeditrun/rer/internal/cli/hosted-output.mjs';
import { checkHydration } from '@runeditrun/rer/internal/cli/hydration/check.mjs';
import { commandAdapter } from '../installer/local.mjs';

const root = process.cwd();
const declaration = commandAdapter.deployDeclaration ?? commandAdapter.deploy?.declaration;
console.log(await checkHostedOutput(root, { declaration }));
console.log(await checkHydration(root, {
  declaration,
  pages: commandAdapter.publicPages,
  report: lines => lines.forEach(line => console.log(line)),
}));
