# PR-reviwer

- node version: 16

## Example usage

```yaml
name: PRs reviews reminder

on:
  schedule:
    # Every weekday every 2 hours during working hours, send notification
    - cron: "0 8-17/2 * * 1-5"

jobs:
  pr-reviews-reminder:
    runs-on: ubuntu-latest
    steps:
    - uses: davideviolante/pr-reviews-reminder-action@v2.8.0
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        webhook-url: '' # Required
        channel: '' # Optional, eg: #general
```

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