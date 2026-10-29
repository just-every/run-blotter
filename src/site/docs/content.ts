import { marked } from 'marked'
import index from '../../../docs/README.md?raw'
import gettingStarted from '../../../docs/getting-started.md?raw'
import jobs from '../../../docs/jobs.md?raw'
import documents from '../../../docs/documents-and-review.md?raw'
import billing from '../../../docs/time-and-billing.md?raw'
import moveIn from '../../../docs/move-in.md?raw'
import backup from '../../../docs/backup-and-restore.md?raw'
import agents from '../../../docs/agent-access.md?raw'
import { PATHS, startLine } from '../../base/run-site'
import { run } from '../run'

export interface DocPage {
  path: string
  title: string
  description: string
  html: string
  source: string
}

function compile(slug: string, source: string, markdown: string): DocPage {
  const heading = /^# (.+)\n/.exec(markdown)
  if (!heading) throw new Error(`Documentation ${source} needs a title.`)
  const body = markdown.slice(heading[0].length).trim()
  return {
    path: slug ? `/docs/${slug}` : '/docs',
    title: heading[1],
    description: body.split('\n\n')[0].replace(/\n/g, ' '),
    html: marked.parse(body, { async: false, gfm: true }),
    source: `docs/${source}`,
  }
}

// These repository Markdown files are compiled into HTML at build time.
// No Markdown renderer, network request or JavaScript is sent to the reader.
export const docs = [
  compile('', 'README.md', index),
  compile('getting-started', 'getting-started.md', gettingStarted
    .replace(/^```sh\n[\s\S]*?\n```/m, () => `\`\`\`sh\n${startLine(run)}\n\`\`\``)
    .replace(/`npx -y @runeditrun\/rer dev [^`]+`/, () => `\`${run.clone}\``)
    .replace('macOS, Linux or Windows with WSL2. git is required; rer brings Node and pnpm.', PATHS.self.requirements)),
  compile('jobs', 'jobs.md', jobs),
  compile('documents-and-review', 'documents-and-review.md', documents),
  compile('time-and-billing', 'time-and-billing.md', billing),
  compile('move-in', 'move-in.md', moveIn),
  compile('backup-and-restore', 'backup-and-restore.md', backup),
  compile('agent-access', 'agent-access.md', agents),
]
