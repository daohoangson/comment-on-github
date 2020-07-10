import {debug} from '@actions/core'
import {context, getOctokit} from '@actions/github'

interface Pull {
  head: {sha: string}
  number: number
  url: string
}

interface Comment {
  id: number
  body: string
  url: string
}

interface Release {
  id: number
  body: string
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
  commit: {
    appendComment: (comment: Comment) => Promise<Comment>
    createComment: () => Promise<Comment>
    getCommentByPrefix: () => Promise<Comment | undefined>
  }
  pull: {
    appendComment: (comment: Comment) => Promise<Comment>
    createComment: (pullNumber: number) => Promise<Comment>
    getCommentByPrefix: (pullNumber: number) => Promise<Comment | undefined>
    getNumberByAfter: (after: string) => Promise<number>
  }
  release: {
    append: (release: Release) => Promise<Release>
    create: (tagName: string) => Promise<Release>
    getById: (releaseId: number) => Promise<Release>
    getByTag: (tagName: string) => Promise<Release>
  }
} => {
  const {fingerprint} = opts
  const octokit = getOctokit(token)
  const {owner, repo} = context.repo
  const {sha} = context

  return {
    commit: {
      appendComment: async (comment: Comment): Promise<Comment> => {
        debug(`repos.updateCommitComment(comment_id=${comment.id})`)
        const {data} = await octokit.repos.updateCommitComment({
          owner,
          repo,
          ['comment_id']: comment.id,
          body: `${comment.body}\n\n${body}`
        })
        return data
      },

      createComment: async (): Promise<Comment> => {
        debug(`repos.createCommitComment(commit_sha=${sha})`)
        const {data} = await octokit.repos.createCommitComment({
          owner,
          repo,
          ['commit_sha']: sha,
          body: (fingerprint ? `${fingerprint}\n\n` : '') + body
        })
        return data
      },

      getCommentByPrefix: async (): Promise<Comment | undefined> => {
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
      }
    },
    pull: {
      appendComment: async (comment: Comment): Promise<Comment> => {
        debug(`issues.updateComment(comment_id=${comment.id})`)
        const {data} = await octokit.issues.updateComment({
          owner,
          repo,
          ['comment_id']: comment.id,
          body: `${comment.body}\n\n${body}`
        })
        return data
      },

      createComment: async (pullNumber: number): Promise<Comment> => {
        debug(`issues.createComment(issue_number=${pullNumber})`)
        const {data} = await octokit.issues.createComment({
          owner,
          repo,
          ['issue_number']: pullNumber,
          body: (fingerprint ? `${fingerprint}\n\n` : '') + body
        })
        return data
      },

      getCommentByPrefix: async (
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
      },

      getNumberByAfter: async (after: string): Promise<number> => {
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
      }
    },
    release: {
      append: async (release: Release): Promise<Release> => {
        debug(`repos.updateRelease(release_id=${release.id})`)
        const {data} = await octokit.repos.updateRelease({
          owner,
          repo,
          ['release_id']: release.id,
          body: `${release.body}\n\n${body}`
        })
        return data
      },

      create: async (tagName: string): Promise<Release> => {
        debug(`repos.createRelease(tag_name=${tagName})`)
        const {data} = await octokit.repos.createRelease({
          owner,
          repo,
          ['tag_name']: tagName,
          body
        })
        return data
      },

      getById: async (releaseId: number): Promise<Release> => {
        debug(`repos.getRelease(release_id=${releaseId})`)
        const {data} = await octokit.repos.getRelease({
          owner,
          repo,
          ['release_id']: releaseId
        })
        return data
      },

      getByTag: async (tag: string): Promise<Release> => {
        debug(`repos.getReleaseByTag(tag=${tag})`)
        const {data} = await octokit.repos.getReleaseByTag({
          owner,
          repo,
          tag
        })
        return data
      }
    }
  }
}

export default _
