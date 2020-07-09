import {debug, getInput, setFailed, setOutput} from '@actions/core'
import {context, getOctokit} from '@actions/github'
import Webhooks from '@octokit/webhooks'

async function _comment(
  body: string,
  token: string,
  options: {fingerprint?: string} = {}
): Promise<string> {
  const {owner, repo} = context.repo
  const {fingerprint} = options
  let issueNumber = 0

  const octokit = getOctokit(token)
  switch (context.eventName) {
    case 'pull_request': {
      const prPayload = context.payload as Webhooks.WebhookPayloadPullRequest
      issueNumber = prPayload.number
      debug(`issueNumber=${issueNumber} from WebhookPayloadPullRequest`)
      break
    }
    case 'push': {
      const pulls = await octokit.pulls.list({owner, repo, state: 'open'})
      const pushPayload = context.payload as Webhooks.WebhookPayloadPush
      pulls.data
        .filter(pull => pull.head.sha === pushPayload.after)
        .map(pull => (issueNumber = pull.id))
      debug(`issueNumber=${issueNumber} from WebhookPayloadPush`)
      break
    }
  }

  if (issueNumber > 0) {
    if (fingerprint) {
      const comments = await octokit.pulls.list({
        owner,
        repo,
        ['issue_number']: issueNumber
      })
      for (const comment of comments.data) {
        if (comment.body.startsWith(fingerprint)) {
          debug(`comment id=${comment.id}: updating`)
          return octokit.issues
            .updateComment({
              owner,
              repo,
              ['comment_id']: comment.id,
              body: `${comment.body}\n\n${body}`
            })
            .then(({data: {url}}) => url)
        } else {
          debug(`comment id=${comment.id}: ignoring`)
        }
      }
    }

    debug('createComment...')
    return octokit.issues
      .createComment({
        owner,
        repo,
        ['issue_number']: issueNumber,
        body: `${fingerprint ? fingerprint : ''}${body}`
      })
      .then(({data: {url}}) => url)
  }

  if (fingerprint) {
    const comments = await octokit.repos.listCommentsForCommit({
      owner,
      repo,
      ['commit_sha']: context.sha
    })
    for (const comment of comments.data) {
      if (comment.body.startsWith(fingerprint)) {
        debug(`comment id=${comment.id}: updating`)
        return octokit.repos
          .updateCommitComment({
            owner,
            repo,
            ['comment_id']: comment.id,
            body: `${comment.body}\n\n${body}`
          })
          .then(({data: {url}}) => url)
      } else {
        debug(`comment id=${comment.id}: ignoring`)
      }
    }
  }

  debug('createCommitComment...')
  return octokit.repos
    .createCommitComment({
      owner,
      repo,
      ['commit_sha']: context.sha,
      body: `${fingerprint ? fingerprint : ''}${body}`
    })
    .then(({data: {url}}) => url)
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
    url => setOutput('url', url),
    error => setFailed(error)
  )
}

run()
