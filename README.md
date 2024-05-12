# PR-reviwer


# Why

- notify 

## Sample Usage 

```yaml
name: PRs reviews reminder

on:
  schedule:
    # Every weekday 10:00 during working hours, send notification
    - cron: "0 10 * * 1-5"

jobs:
  my_job:
    runs-on: ubuntu-latest
    permissions: # Important ! assign Github read permission to PR-reviewer
      pull-requests: read 
    steps:
      - name: PR Reviewer
        uses: nissenyeh/PR-reviewer@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} # or Your personal token
          OPENAI_TOKEN: ${{ secrets.OPENAI_TOKEN }}
          SLACK_TOKEN: <<SLACK_TOKEN >>
        with:
          webhook-url: 'https://hooks.slack.com/services/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' # Required
          slack-channel-name: '#nissen測試' # Optional, eg: #general

```

## Env

### How to get GITHUB_TOKEN

1. Use `Github token ${{ secrets.GITHUB_TOKEN }}`


If you use  `${{ secrets.GITHUB_TOKEN }}`, GitHub will `automatically` creates a unique GITHUB_TOKEN in workflow job (So you don't have to get anything from it)
 (Please refer to https://docs.github.com/en/actions/security-guides/automatic-token-authentication)


2. Use `Personal Access Token`

- Github Profile - Developer Setting: https://github.com/settings/apps

- Personal access tokens -  Generate new token - Pull requests (Access: Read-only)

## How to get OPENAI_TOKEN

- https://platform.openai.com/api-keys


## How to Get SLACK TOKEN & Install Slack Bot in Channel

- Visit https://api.slack.com/apps

### 1. Create A app

![Alt text](<CleanShot 2024-05-10 at 18.16.52.png>)
![Alt text](<CleanShot 2024-05-10 at 18.10.42.png>)
![Alt text](<CleanShot 2024-05-10 at 18.16.32.png>)

### 2. Get OAuth Token

- Set `OAuth & Permissions`
2-1. Install App to Workspace 
![Alt text](<CleanShot 2024-05-10 at 18.17.45.png>)
![Alt text](<CleanShot 2024-05-10 at 18.19.11.png>)
![Alt text](<CleanShot 2024-05-10 at 18.20.56@2x.png>)
2-2. Get OAuth Token
![Alt text](<CleanShot 2024-05-10 at 18.21.24.png>)


### 3. Set OAuth Scope

1.  `Scopes` Section  
2.  Click  `Add an OAuth Scope` 
3. chose `chat:write`


![Alt text](<CleanShot 2024-05-10 at 18.18.37.png>)


### 4. Invite Bot to Slack channel

1. Go to your slack channel 
2. `/invite @appName`

![Alt text](<CleanShot 2024-05-10 at 18.42.00@2x.png>)
![Alt text](<CleanShot 2024-05-10 at 18.42.24@2x.png>)


or you may meet 

```
Error: An API error occurred: not_in_channel
    at Object.platformErrorFromResult (/home/runner/work/_actions/nissenyeh/PR-reviewer/main/dist/index.js:2717:33)
    at WebClient.apiCall (/home/runner/work/_actions/nissenyeh/PR-reviewer/main/dist/index.js:2359:28)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async sendSlackNotification (/home/runner/work/_actions/nissenyeh/PR-reviewer/main/dist/index.js:39806:10) {
  code: 'slack_webapi_platform_error',
  data: {
    ok: false,
    error: 'not_in_channel',
    response_metadata: {
      scopes: [ 'incoming-webhook', 'chat:write' ],
      acceptedScopes: [ 'chat:write' ]
    }
  }
}
```


## 想法

1. 統計＋AI

- slack token 
- 支援 thread 的回覆

2. 統計

- slack webhook


# Slack

## 如何獲取 Slack webhook URL

https://api.slack.com/messaging/webhooks

1. Create APP

https://api.slack.com/apps?new_app=1

2. Enable incoming webhooks 

要獲取 Slack webhook URL，請按照以下步驟進行操作：
1. 登錄到你的 Slack 帳戶。
2. 前往你想要設置 webhook 的工作區或頻道。
3. 選擇 "Apps" -> "Custom Integrations" -> "Incoming Webhooks"。
4. 選擇要添加 webhook 的頻道，然後設置 webhook。
5. 在設置 webhook 過程中，將會獲得一個 webhook URL，這個 URL 就是你需要填寫到相應的地方。

https://junyiacademy.slack.com/account/settings#username


## 如何獲取 Slack Token

channelId

slack token



## 如何獲取 OPENAI_TOKEN





## AI

- OAuth Scope - chose `chat:write` `channels:history`


## 心得

1. 黏在目標上：第一個做這個專案時，我覺得很開心
  - 學到如何寫 github Action 
  - 開始會有很多想法：現在統計 PR ，那接下來可以用 github commit

2. 盡快 release，不然這個想法會死掉

3. 願景的重要性

- 