import {debug, getInput, setFailed, setOutput} from '@actions/core'
import {context} from '@actions/github'
import Webhooks from '@octokit/webhooks'

import octokit, {Opts} from './octokit'

async function _comment(
  body: string,
  token: string,
  opts: Opts = {}
): Promise<{
  action: 'created' | 'updated'
  target: 'commit' | 'pull'
  url: string
}> {
  const o = octokit(body, token, opts)

  let pullNumber = 0
  switch (context.eventName) {
    case 'pull_request': {
      const {number} = context.payload as Webhooks.WebhookPayloadPullRequest
      pullNumber = number
      debug(`pullNumber=${pullNumber} from WebhookPayloadPullRequest`)
      break
    }
    case 'push': {
      const {after} = context.payload as Webhooks.WebhookPayloadPush
      pullNumber = await o.getPullNumberByAfter(after)
      debug(`pullNumber=${pullNumber} from WebhookPayloadPush`)
      break
    }
  }

  if (pullNumber > 0) {
    const pullComment = await o.getPullCommentByPrefix(pullNumber)
    if (pullComment) {
      const {url} = await o.appendPullComment(pullComment)
      return {action: 'updated', target: 'pull', url}
    }

    const {url} = await o.createPullComment(pullNumber)
    return {action: 'created', target: 'pull', url}
  }

  const commitComment = await o.getCommitCommentByPrefix()
  if (commitComment) {
    const {url} = await o.appendCommitComment(commitComment)
    return {action: 'updated', target: 'commit', url}
  }

  const {url} = await o.createCommitComment()
  return {action: 'created', target: 'commit', url}
}

async function run(): Promise<void> {
  const body: string = getInput('body').trim()
  if (!body) {
    setFailed('Input `body` is required')
    return
  }

  const token: string | undefined = process.env['GITHUB_TOKEN']
  if (!token) {
    setFailed('Env var `GITHUB_TOKEN` is required')
    return
  }

  await _comment(body, token, {
    fingerprint: getInput('fingerprint')
  }).then(
    ({action, target, url}) => {
      setOutput('action', action)
      setOutput('target', target)
      setOutput('url', url)
    },
    error => setFailed(error)
  )
}

run()
