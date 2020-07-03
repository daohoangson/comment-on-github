# Comment on GitHub

A GitHub action to comment on matching PR or commit.

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
      - uses: daohoangson/action-comment-on-github@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          msg: "Check out this message!"
```
