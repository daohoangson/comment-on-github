#!/usr/bin/env ruby

require "json"
require "octokit"

json = File.read(ENV.fetch("GITHUB_EVENT_PATH"))
event = JSON.parse(json)

if !ENV["GITHUB_TOKEN"]
  puts "Missing GITHUB_TOKEN"
  exit(1)
end

if ARGV[0].empty?
  puts "Missing message argument."
  exit(1)
end

github = Octokit::Client.new(access_token: ENV["GITHUB_TOKEN"])

message = ARGV[0]
repo = event["repository"]["full_name"]

if ENV.fetch("GITHUB_EVENT_NAME") == "pull_request"
  github.add_comment(repo, event["number"], message)
else
  pulls = github.pull_requests(repo, state: "open")

  push_head = event["after"]
  pr = pulls.find { |pr| pr["head"]["sha"] == push_head }

  if pr
    github.add_comment(repo, pr["number"], message)
  else
    github.create_commit_comment(repo, ENV.fetch("GITHUB_SHA"), message)
  end
end
