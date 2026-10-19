import run from '../run.json'

/** Every place the run site links: its own pages, the live contract page and the public source. */
export const links = {
  home: '/',
  run: '/run',
  docs: '/docs',
  contract: '/contract',
  source: run.repository,
  licence: `${run.repository}/blob/main/LICENSE`,
  // The live demo deployment (deploy-demo.json, run-demo.yml): demo.run-blotter.com.
  demo: 'https://demo.run-blotter.com/',
}
