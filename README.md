# Comment on GitHub

An Action to comment on the relevant GitHub PR / comment on push.
This is a fork of https://github.com/unsplash/comment-on-pr.

## Usage

- Runs on Ubuntu, macOS and Windows virtual environments.
- Requires the `GITHUB_TOKEN` secret.
- Requires the comment's body in the `body` parameter.
- Supports `push` and `pull_request` event types.

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
```
