import {getInput, setFailed, setOutput} from '@actions/core'
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
    case 'pull_request':
      issueNumber = context.issue.number
      break
    case 'push': {
      const pulls = await octokit.pulls.list({owner, repo, state: 'open'})
      const payload = context.payload as Webhooks.WebhookPayloadPush
      pulls.data
        .filter(pull => pull.head.sha === payload.after)
        .map(pull => (issueNumber = pull.id))
      break
    }
  }

  if (issueNumber > 0) {
    if (fingerprint) {
      const comments = await octokit.issues.listComments({
        owner,
        repo,
        ['issue_number']: context.issue.number
      })
      for (const comment of comments.data) {
        if (comment.body.startsWith(fingerprint)) {
          return octokit.issues
            .updateComment({
              owner,
              repo,
              ['comment_id']: comment.id,
              body: `${comment.body}\n\n${body}`
            })
            .then(({data: {url}}) => url)
        }
      }
    }

    return octokit.issues
      .createComment({
        owner,
        repo,
        ['issue_number']: context.issue.number,
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
        return octokit.repos
          .updateCommitComment({
            owner,
            repo,
            ['comment_id']: comment.id,
            body: `${comment.body}\n\n${body}`
          })
          .then(({data: {url}}) => url)
      }
    }
  }

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
    commentUrl => setOutput('commentUrl', commentUrl),
    error => setFailed(error)
  )
}

run()
