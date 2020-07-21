# Comment on GitHub

An Action to comment on the relevant GitHub Release / PR / commit on push.
This is a fork of https://github.com/unsplash/comment-on-pr.

## Usage

- Runs on Ubuntu, macOS and Windows virtual environments.
- Requires the `GITHUB_TOKEN` secret.
- Requires the comment's body in the `body` parameter.
- Supports `push`, `pull_request` and `release` event types. It's not recommend to combine `push` with others to avoid duplicated work, some common scenarios to consider:

| Action                        | Events                                                                |
| ----------------------------- | --------------------------------------------------------------------- |
| Push commit                   | push:refs/heads/                                                      |
| Push commit in PR             | push:refs/heads/, pull_request:synchronize                            |
| Push tag                      | push:refs/tags/                                                       |
| Create release from GitHub UI | release:created, release:published, release:released, push:refs/tags/ |

### Sample workflow

```yaml
on: push
jobs:
  example:
    runs-on: ubuntu-latest
    steps:
      - uses: daohoangson/comment-on-github@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          body: "Check out this comment!"
          fingerprint: <!-- ${{ github.sha }} --> # optional, will be appended to `body` and used to auto-merge comments
          replace: please # optional, comment will be replaced on fingerprint match instead of being appended
```
