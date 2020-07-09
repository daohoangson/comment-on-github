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
      const pushPayload = context.payload as Webhooks.WebhookPayloadPush

      debug('pulls.list(state=open)...')
      const pulls = await octokit.pulls.list({owner, repo, state: 'open'})

      for (const pull of pulls.data) {
        if (pull.head.sha === pushPayload.after) {
          issueNumber = pull.id
          debug(
            `issueNumber=${issueNumber} from WebhookPayloadPush (url=${pull.url})`
          )
        } else {
          debug(`Ignoring pull: id=${pull.id}, url=${pull.url}`)
        }
      }
      break
    }
  }

  if (issueNumber > 0) {
    if (fingerprint) {
      debug(`issues.listComments(issue_number=${issueNumber})...`)
      const comments = await octokit.issues.listComments({
        owner,
        repo,
        ['issue_number']: issueNumber
      })
      for (const comment of comments.data) {
        if (comment.body.startsWith(fingerprint)) {
          debug(`issues.updateComment(comment_id=${comment.id})...`)
          return octokit.issues
            .updateComment({
              owner,
              repo,
              ['comment_id']: comment.id,
              body: `${comment.body}\n\n${body}`
            })
            .then(({data: {url}}) => url)
        } else {
          debug(`Ignoring comment: id=${comment.id}, url=${comment.url}`)
        }
      }
    }

    debug(`issues.createComment(issue_number=${issueNumber})...`)
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
    debug(`repos.listCommentsForCommit(commit_sha=${context.sha})...`)
    const comments = await octokit.repos.listCommentsForCommit({
      owner,
      repo,
      ['commit_sha']: context.sha
    })
    for (const comment of comments.data) {
      if (comment.body.startsWith(fingerprint)) {
        debug(`repos.updateCommitComment(comment_id=${comment.id})...`)
        return octokit.repos
          .updateCommitComment({
            owner,
            repo,
            ['comment_id']: comment.id,
            body: `${comment.body}\n\n${body}`
          })
          .then(({data: {url}}) => url)
      } else {
        debug(`Ignoring comment: id=${comment.id}, url=${comment.url}`)
      }
    }
  }

  debug(`repos.createCommitComment(commit_sha=${context.sha})...`)
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
