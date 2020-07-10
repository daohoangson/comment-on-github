import {debug} from '@actions/core'
import {context, getOctokit} from '@actions/github'

interface Pull {
  head: {sha: string}
  number: number
  url: string
}

interface Comment {
  body: string
  id: number
  url: string
}

export interface Opts {
  fingerprint?: string
}

const _ = (
  body: string,
  token: string,
  opts: Opts
): {
  appendCommitComment: (comment: Comment) => Promise<Comment>
  appendPullComment: (comment: Comment) => Promise<Comment>
  createCommitComment: () => Promise<Comment>
  createPullComment: (pullNumber: number) => Promise<Comment>
  getCommitCommentByPrefix: () => Promise<Comment | undefined>
  getPullNumberByAfter: (after: string) => Promise<number>
  getPullCommentByPrefix: (pullNumber: number) => Promise<Comment | undefined>
} => {
  const {fingerprint} = opts
  const octokit = getOctokit(token)
  const {owner, repo} = context.repo
  const {sha} = context

  return {
    appendCommitComment: async (comment: Comment): Promise<Comment> => {
      debug(`repos.updateCommitComment(comment_id=${comment.id})`)
      const {data} = await octokit.repos.updateCommitComment({
        owner,
        repo,
        ['comment_id']: comment.id,
        body: `${comment.body}\n\n${body}`
      })
      return data
    },

    appendPullComment: async (comment: Comment): Promise<Comment> => {
      debug(`issues.updateComment(comment_id=${comment.id})`)
      const {data} = await octokit.issues.updateComment({
        owner,
        repo,
        ['comment_id']: comment.id,
        body: `${comment.body}\n\n${body}`
      })
      return data
    },

    createCommitComment: async (): Promise<Comment> => {
      debug(`repos.createCommitComment(commit_sha=${sha})`)
      const {data} = await octokit.repos.createCommitComment({
        owner,
        repo,
        ['commit_sha']: sha,
        body: (fingerprint ? `${fingerprint}\n\n` : '') + body
      })
      return data
    },

    createPullComment: async (pullNumber: number): Promise<Comment> => {
      debug(`issues.createComment(issue_number=${pullNumber})`)
      const {data} = await octokit.issues.createComment({
        owner,
        repo,
        ['issue_number']: pullNumber,
        body: (fingerprint ? `${fingerprint}\n\n` : '') + body
      })
      return data
    },

    getCommitCommentByPrefix: async (): Promise<Comment | undefined> => {
      if (!fingerprint) return

      const options = octokit.repos.listCommentsForCommit.endpoint.merge({
        owner,
        repo,
        ['commit_sha']: sha
      })
      debug(`repos.listCommentsForCommit(commit_sha=${sha})`)
      const comments: Comment[] = await octokit.paginate(options)

      for (const comment of comments) {
        if (comment.body.startsWith(fingerprint)) {
          debug(`Found commit comment ${comment.url}`)
          return comment
        } else {
          debug(`Ignoring commit comment ${comment.url}`)
        }
      }
    },

    getPullNumberByAfter: async (after: string): Promise<number> => {
      const options = octokit.pulls.list.endpoint.merge({
        owner,
        repo,
        state: 'open'
      })
      debug(`pulls.list(state=open)`)
      const pulls: Pull[] = await octokit.paginate(options)

      for (const pull of pulls) {
        if (pull.head.sha === after) {
          debug(`Found pull ${pull.url}`)
          return pull.number
        } else {
          debug(`Ignoring pull ${pull.url}`)
        }
      }

      return 0
    },

    getPullCommentByPrefix: async (
      pullNumber: number
    ): Promise<Comment | undefined> => {
      if (!fingerprint) return

      const options = octokit.issues.listComments.endpoint.merge({
        owner,
        repo,
        ['issue_number']: pullNumber
      })
      debug(`issues.listComments(issue_number=${pullNumber})`)
      const comments: Comment[] = await octokit.paginate(options)

      for (const comment of comments) {
        if (comment.body.startsWith(fingerprint)) {
          debug(`Found pull comment ${comment.url}`)
          return comment
        } else {
          debug(`Ignoring pull comment ${comment.url}`)
        }
      }
    }
  }
}

export default _
