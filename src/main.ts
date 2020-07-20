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
  target: 'commit_comment' | 'pull_comment' | 'release'
  url: string
}> {
  const o = octokit(body, token, opts)

  let pullNumber = 0
  let releaseId = 0
  let tagName: string | undefined
  switch (context.eventName) {
    case 'pull_request': {
      const {number} = context.payload as Webhooks.WebhookPayloadPullRequest
      pullNumber = number
      debug(`pullNumber=${pullNumber} from WebhookPayloadPullRequest`)
      break
    }
    case 'push': {
      const {after, ref} = context.payload as Webhooks.WebhookPayloadPush
      if (ref.startsWith('refs/tags/')) {
        tagName = ref.substr(10)
      }
      pullNumber = await o.pull.getNumberByAfter(after)
      debug(`pullNumber=${pullNumber} from WebhookPayloadPush`)
      break
    }
    case 'release': {
      const {
        release: {id, tag_name: releaseTagName}
      } = context.payload as Webhooks.WebhookPayloadRelease
      releaseId = id
      tagName = releaseTagName
      break
    }
  }

  if (tagName) {
    const release = releaseId
      ? await o.release.getById(releaseId)
      : await o.release.getByTag(tagName)
    if (release) {
      const {url} = await o.release.append(release)
      return {action: 'updated', target: 'release', url}
    }

    const {url} = await o.release.create(tagName)
    return {action: 'created', target: 'release', url}
  }

  if (pullNumber > 0) {
    const pullComment = await o.pull.getCommentByPrefix(pullNumber)
    if (pullComment) {
      const {url} = await o.pull.appendOrReplaceComment(pullComment)
      return {action: 'updated', target: 'pull_comment', url}
    }

    const {url} = await o.pull.createComment(pullNumber)
    return {action: 'created', target: 'pull_comment', url}
  }

  const commitComment = await o.commit.getCommentByPrefix()
  if (commitComment) {
    const {url} = await o.commit.appendOrReplaceComment(commitComment)
    return {action: 'updated', target: 'commit_comment', url}
  }

  const {url} = await o.commit.createComment()
  return {action: 'created', target: 'commit_comment', url}
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
    fingerprint: getInput('fingerprint'),
    replace: getInput('replace')
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
