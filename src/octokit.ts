import {debug, error} from '@actions/core'
import {context, getOctokit} from '@actions/github'
import {serializeError} from 'serialize-error'

interface Pull {
  head: {sha: string}
  number: number
  url: string
}

interface Comment {
  id: number
  body?: string
  url: string
}

interface Release {
  id: number
  body?: string | null
  url: string
}

export interface Opts {
  fingerprint?: string
  replace?: string
}

function getCommentByPrefix(
  comments: Comment[],
  prefix: string
): Comment | undefined {
  for (const comment of comments) {
    const {body, url} = comment
    if (typeof body === 'string') {
      if (body.startsWith(prefix)) {
        debug(`Found comment ${url}`)
        return comment
      } else {
        debug(`Ignoring comment ${url}`)
      }
    } else {
      error(
        `Comment body is not a string: url=${url} body=${body} typeof body=${typeof body}`
      )
    }
  }
}

const _ = (
  body: string,
  token: string,
  opts: Opts
): {
  commit: {
    appendOrReplaceComment: (comment: Comment) => Promise<Comment>
    createComment: () => Promise<Comment>
    getCommentByPrefix: () => Promise<Comment | undefined>
  }
  pull: {
    appendOrReplaceComment: (comment: Comment) => Promise<Comment>
    createComment: (pullNumber: number) => Promise<Comment>
    getCommentByPrefix: (pullNumber: number) => Promise<Comment | undefined>
    getNumberByAfter: (after: string) => Promise<number>
  }
  release: {
    append: (release: Release) => Promise<Release>
    create: (tagName: string) => Promise<Release>
    getById: (releaseId: number) => Promise<Release>
    getByTag: (tagName: string) => Promise<Release | undefined>
  }
} => {
  const {fingerprint, replace} = opts
  const octokit = getOctokit(token)
  const {owner, repo} = context.repo
  const {sha} = context
  const bodyWithFingerprint = (fingerprint ? `${fingerprint}\n\n` : '') + body

  return {
    commit: {
      appendOrReplaceComment: async (comment: Comment): Promise<Comment> => {
        debug(`repos.updateCommitComment(comment_id=${comment.id})`)
        const {data} = await octokit.rest.repos.updateCommitComment({
          owner,
          repo,
          ['comment_id']: comment.id,
          body: replace ? bodyWithFingerprint : `${comment.body}\n\n${body}`
        })
        return data
      },

      createComment: async (): Promise<Comment> => {
        debug(`repos.createCommitComment(commit_sha=${sha})`)
        const {data} = await octokit.rest.repos.createCommitComment({
          owner,
          repo,
          ['commit_sha']: sha,
          body: bodyWithFingerprint
        })
        return data
      },

      getCommentByPrefix: async (): Promise<Comment | undefined> => {
        if (!fingerprint) return

        const options = octokit.rest.repos.listCommentsForCommit.endpoint.merge(
          {
            owner,
            repo,
            ['commit_sha']: sha
          }
        )
        debug(`repos.listCommentsForCommit(commit_sha=${sha})`)
        const comments: Comment[] = await octokit.paginate(options)
        return getCommentByPrefix(comments, fingerprint)
      }
    },
    pull: {
      appendOrReplaceComment: async (comment: Comment): Promise<Comment> => {
        debug(`issues.updateComment(comment_id=${comment.id})`)
        const {data} = await octokit.rest.issues.updateComment({
          owner,
          repo,
          ['comment_id']: comment.id,
          body: replace ? bodyWithFingerprint : `${comment.body}\n\n${body}`
        })
        return data
      },

      createComment: async (pullNumber: number): Promise<Comment> => {
        debug(`issues.createComment(issue_number=${pullNumber})`)
        const {data} = await octokit.rest.issues.createComment({
          owner,
          repo,
          ['issue_number']: pullNumber,
          body: bodyWithFingerprint
        })
        return data
      },

      getCommentByPrefix: async (
        pullNumber: number
      ): Promise<Comment | undefined> => {
        if (!fingerprint) return

        const options = octokit.rest.issues.listComments.endpoint.merge({
          owner,
          repo,
          ['issue_number']: pullNumber
        })
        debug(`issues.listComments(issue_number=${pullNumber})`)
        const comments: Comment[] = await octokit.paginate(options)
        return getCommentByPrefix(comments, fingerprint)
      },

      getNumberByAfter: async (after: string): Promise<number> => {
        const options = octokit.rest.pulls.list.endpoint.merge({
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
        const {data} = await octokit.rest.repos.updateRelease({
          owner,
          repo,
          ['release_id']: release.id,
          body: `${release.body}\n\n${body}`
        })
        return data
      },

      create: async (tagName: string): Promise<Release> => {
        debug(`repos.createRelease(tag_name=${tagName})`)
        const {data} = await octokit.rest.repos.createRelease({
          owner,
          repo,
          ['tag_name']: tagName,
          body
        })
        return data
      },

      getById: async (releaseId: number): Promise<Release> => {
        debug(`repos.getRelease(release_id=${releaseId})`)
        const {data} = await octokit.rest.repos.getRelease({
          owner,
          repo,
          ['release_id']: releaseId
        })
        return data
      },

      getByTag: async (tag: string): Promise<Release | undefined> => {
        debug(`repos.getReleaseByTag(tag=${tag})`)
        try {
          const {data} = await octokit.rest.repos.getReleaseByTag({
            owner,
            repo,
            tag
          })
          return data
        } catch (reason) {
          if (reason instanceof Error) {
            error(reason)
          } else {
            error(JSON.stringify(serializeError(reason)))
          }
          return undefined
        }
      }
    }
  }
}

export default _
