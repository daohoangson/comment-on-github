# Comment on GitHub

A GitHub action to comment on matching PR or commit.
This is a fork of https://github.com/unsplash/comment-on-pr.

## Usage

- Requires the `GITHUB_TOKEN` secret.
- Requires the comment's message in the `msg` parameter.
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
          message: "Check out this message!"
```
