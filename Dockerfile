FROM ruby:2.7-alpine

LABEL "com.github.actions.name"="Comment on GitHub"
LABEL "com.github.actions.description"="Leaves a comment on matching PR or commit."
LABEL "com.github.actions.repository"="https://github.com/daohoangson/comment-on-github"
LABEL "com.github.actions.maintainer"="Dao Hoang Son <dao@hoangson.vn>"
LABEL "com.github.actions.icon"="message-square"
LABEL "com.github.actions.color"="blue"

RUN gem install octokit

ADD entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]