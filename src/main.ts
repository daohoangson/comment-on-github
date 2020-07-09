import {debug, getInput, setFailed, setOutput} from '@actions/core'
import {context, getOctokit} from '@actions/github'
import Webhooks from '@octokit/webhooks'

async function _comment(
  body: string,
  token: string,
  options: {fingerprint?: string} = {}
): Promise<{
  action: 'created' | 'updated'
  target: 'commit' | 'issue'
  url: string
}> {
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

      let page = 1
      let hasNext = true
      while (hasNext) {
        debug(`pulls.list(state=open, page=${page})`)
        const pulls = await octokit.pulls.list({
          owner,
          repo,
          state: 'open',
          page
        })

        for (const pull of pulls.data) {
          if (pull.head.sha === pushPayload.after) {
            issueNumber = pull.number
            debug(`issueNumber=${issueNumber} from pull.url=${pull.url}`)
          } else {
            debug(`Ignoring pull: id=${pull.id}, url=${pull.url}`)
          }
        }

        const {link} = pulls.headers
        debug(`pulls.list -> headers.link=${link}`)
        if (link && link.includes('rel="next"')) {
          page++
        } else {
          hasNext = false
        }
      }
      break
    }
  }

  if (issueNumber > 0) {
    if (fingerprint) {
      let page = 1
      let hasNext = true
      while (hasNext) {
        debug(`issues.listComments(issue_number=${issueNumber}, page=${page})`)
        const comments = await octokit.issues.listComments({
          owner,
          repo,
          ['issue_number']: issueNumber,
          page
        })
        for (const comment of comments.data) {
          if (comment.body.startsWith(fingerprint)) {
            debug(`issues.updateComment(comment_id=${comment.id})`)
            return octokit.issues
              .updateComment({
                owner,
                repo,
                ['comment_id']: comment.id,
                body: `${comment.body}\n\n${body}`
              })
              .then(({data: {url}}) => ({
                action: 'updated',
                target: 'issue',
                url
              }))
          } else {
            debug(`Ignoring comment: id=${comment.id}, url=${comment.url}`)
          }
        }

        const {link} = comments.headers
        debug(`issues.listComments -> headers.link=${link}`)
        if (link && link.includes('rel="next"')) {
          page++
        } else {
          hasNext = false
        }
      }
    }

    debug(`issues.createComment(issue_number=${issueNumber})`)
    return octokit.issues
      .createComment({
        owner,
        repo,
        ['issue_number']: issueNumber,
        body: (fingerprint ? `${fingerprint}\n\n` : '') + body
      })
      .then(({data: {url}}) => ({action: 'created', target: 'issue', url}))
  }

  if (fingerprint) {
    let page = 1
    let hasNext = true
    while (hasNext) {
      debug(`repos.listCommentsForCommit(commit_sha=${context.sha})`)
      const comments = await octokit.repos.listCommentsForCommit({
        owner,
        repo,
        ['commit_sha']: context.sha,
        page
      })
      for (const comment of comments.data) {
        if (comment.body.startsWith(fingerprint)) {
          debug(`repos.updateCommitComment(comment_id=${comment.id})`)
          return octokit.repos
            .updateCommitComment({
              owner,
              repo,
              ['comment_id']: comment.id,
              body: `${comment.body}\n\n${body}`
            })
            .then(({data: {url}}) => ({
              action: 'updated',
              target: 'commit',
              url
            }))
        } else {
          debug(`Ignoring comment: id=${comment.id}, url=${comment.url}`)
        }
      }

      const {link} = comments.headers
      debug(`repos.listCommentsForCommit -> headers.link=${link}`)
      if (link && link.includes('rel="next"')) {
        page++
      } else {
        hasNext = false
      }
    }
  }

  debug(`repos.createCommitComment(commit_sha=${context.sha})`)
  return octokit.repos
    .createCommitComment({
      owner,
      repo,
      ['commit_sha']: context.sha,
      body: (fingerprint ? `${fingerprint}\n\n` : '') + body
    })
    .then(({data: {url}}) => ({action: 'created', target: 'commit', url}))
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
