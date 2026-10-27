import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {test} from 'node:test'

async function runAction(lookupStatus) {
  const directory = await mkdtemp(join(tmpdir(), 'comment-on-github-'))
  const eventPath = join(directory, 'event.json')
  const outputPath = join(directory, 'output')
  await writeFile(eventPath, JSON.stringify({after: 'abc', ref: 'refs/tags/v1'}))
  await writeFile(outputPath, '')
  const requests = []
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({method: req.method, url: req.url, body: body && JSON.parse(body)})
    res.setHeader('content-type', 'application/json')
    if (req.url === '/repos/test/repo/pulls?state=open') return res.end('[]')
    if (req.url === '/repos/test/repo/releases/tags/v1') {
      res.statusCode = lookupStatus
      return res.end(JSON.stringify(lookupStatus === 200
        ? {id: 42, body: 'existing', url: 'https://example.com/release'}
        : {message: lookupStatus === 404 ? 'Not Found' : 'Forbidden'}))
    }
    if (req.method === 'POST' || req.method === 'PATCH') {
      res.statusCode = req.method === 'POST' ? 201 : 200
      return res.end(JSON.stringify({id: 42, url: 'https://example.com/release'}))
    }
    res.statusCode = 500
    res.end(JSON.stringify({message: 'Unexpected request'}))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const child = spawn(process.execPath, ['dist/index.min.js'], {
      env: {...process.env, GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
        GITHUB_REPOSITORY: 'test/repo', GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_PATH: eventPath,
        GITHUB_SHA: 'abc', GITHUB_TOKEN: 'test-token', GITHUB_OUTPUT: outputPath,
        INPUT_BODY: 'hello'}
    })
    let log = ''
    child.stdout.on('data', chunk => { log += chunk })
    child.stderr.on('data', chunk => { log += chunk })
    const code = await new Promise((resolve, reject) => {
      child.on('error', reject)
      child.on('close', resolve)
    })
    return {code, log, requests, output: await readFile(outputPath, 'utf8')}
  } finally {
    await new Promise(resolve => server.close(resolve))
    await rm(directory, {recursive: true, force: true})
  }
}

test('creates a release when the tag lookup returns 404', async () => {
  const result = await runAction(404)
  assert.equal(result.code, 0, result.log)
  assert.deepEqual(result.requests.at(-1), {method: 'POST', url: '/repos/test/repo/releases', body: {tag_name: 'v1', body: 'hello'}})
  assert.match(result.output, /created/)
})

test('updates an existing release', async () => {
  const result = await runAction(200)
  assert.equal(result.code, 0, result.log)
  assert.deepEqual(result.requests.at(-1), {method: 'PATCH', url: '/repos/test/repo/releases/42', body: {body: 'existing\n\nhello'}})
  assert.match(result.output, /updated/)
})

test('reports a lookup error without attempting to create a release', async () => {
  const result = await runAction(403)
  assert.equal(result.code, 1, result.log)
  assert.match(result.log, /Forbidden/)
  assert.equal(result.requests.some(request => request.method === 'POST'), false)
})
