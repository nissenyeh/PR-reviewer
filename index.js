
const core = require('@actions/core');
import {execAsync} from './exec-async'
import parseGitDiff from 'parse-git-diff'
const axios = require('axios');

const {
  formatSlackMessageBlock,
  formatSlackMessage,
  getDateHoursAgo,
  calculateTmeDifference,
} = require('./functions');


// fix: GITHUB_TOKEN 拿不到
const { GITHUB_TOKEN, GITHUB_API_URL } = process.env;

const GITHUB_REPOSITORY = 'junyiacademy/junyiacademy'

const AUTH_HEADER = {
  Authorization: `token ${GITHUB_TOKEN}`,
};
const PULLS_ENDPOINT = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/pulls`;



/**
 * Send notification to a channel
 * @param {String} webhookUrl Webhook URL
 * @param {String} messageData Message data object to send into the channel
 * @return {Promise} Axios promise
 */
async function sendNotification(webhookUrl, messageData) {
  return axios({
    method: 'POST',
    url: webhookUrl,
    data: messageData,
  });
}


const SEARCH_ENDPOINT = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/pulls`;

async function getAllOpenPullRequests() {
  const query = `repo:${GITHUB_REPOSITORY} is:pr is:open`;
  return axios({
    method: 'GET',
    url: SEARCH_ENDPOINT,
    headers: AUTH_HEADER,
    params: {
      q: query
    }
  });
}

// call open AI
async function getOpenAI(prompt) {
  const { OPEN_AI_API_TOKEN } = process.env;

  var data = JSON.stringify({
    "messages": [
      {
        "role": "user",
        "content": prompt
      }
    ],
    "max_tokens": 512,
    "temperature": 0.9,
    "model": "gpt-3.5-turbo",
    "stream": false
  });
  var config = {
    method: 'post',
    url: 'https://api.openai.com/v1/chat/completions',
    headers: { 
      'Authorization':  `Bearer ${OPEN_AI_API_TOKEN}`,
      'Content-Type': 'application/json', 
    },
    data : data
  };
  return axios(config);
}

/**
 * Main function for the GitHub Action
 */
async function main() {
  
  const webhookUrl = core.getInput('webhook-url');
  const channel = core.getInput('channel');
  const PRLastUpdateTimeThreshold = core.getInput('pr-last-updated-time-exceeding-x-hours');

  let totalPullRequestCount = 0
  let pullRequestExceedTimeCount = 0
  let reportPullRequest = []

  try {
     // 獲取 Pull Request 標題與內容
    const pullRequests = await getAllOpenPullRequests();
    totalPullRequestCount = pullRequests.data.length

    // 排序從小到大
    const sortedPullRequests = pullRequests.data.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    for (const pr of sortedPullRequests) {

      core.info(`==========Fetch Pull Request==============`);
      core.info(`Pull Request Title: ${pr.title}`);
      core.info(`Pull Request Body: ${pr.body}`);
      core.info(`Pull Request Update time: ${pr.updated_at}`);
      core.info(`Pull Request Create time: ${pr.created_at}`);

      // 開啟時間
      const { hours: hoursOpen , days: daysOpen } = calculateTmeDifference(pr.created_at);
      const daysOpenMessage = daysOpen > 0 ? `(${daysOpen} 天)` : ''

      // 更新時間
      const { hours: lastUpdatedHoursAgo , days: lastUpdatedDaysAgo } = calculateTmeDifference(pr.updated_at)
      const lastUpdatedDaysMessage = lastUpdatedDaysAgo > 0 ? `(${lastUpdatedDaysAgo} 天)` : ''

      // 如果超過 X 小時則跳過
      core.info(`PRLastUpdateTimeThreshold: ${PRLastUpdateTimeThreshold}`,)
      core.info(`lastUpdatedHoursAgo:${lastUpdatedHoursAgo}`)
      if (lastUpdatedHoursAgo <= PRLastUpdateTimeThreshold){
        continue
      }
      
      pullRequestExceedTimeCount += 1;
      
      core.info(`${pr.title}  (Create by @${pr.user.login})`);
      core.info(`已經開啟時間：已經存活 ${hoursOpen} 小時${daysOpenMessage}`);
      core.info(`上次更時間：是 ${lastUpdatedHoursAgo} 小時${lastUpdatedDaysMessage}以前`);

      // 生成 AI 建議
      let aiSuggestion = ''
      try {
        core.info(`=========call open ai===============`);
        const PR_BODY = pr.body.replace(/\n/g, ' ')
        const prompt = `Github Pull Request 內容如下
        標題：${pr.title} 內容：${PR_BODY}
        -----
        請幫我根據以上的標題與內容，用中文遵守以下格式，回答
        1. 簡單介紹 PR 內容
        2. 推薦什麼樣工程師 Review（什麼背景 / 興趣的人）
        `
        //  這邊可以調整一下，如果 fail 送提醒就好
        const ai_response = await getOpenAI(prompt)
        aiSuggestion = ai_response.data.choices[0].message.content
        core.info(aiSuggestion);
      } catch (error) {
        aiSuggestion = '本次沒有生成 AI 建議'
        core.error(error)
        core.error('Open AI 失敗，請檢查並重新嘗試');
      }
      core.info(aiSuggestion)
      
      // 準備發送 slack message
      try {
        core.info(`=========發送 slack 通知===============`);
        core.info(`ready to send message to ${webhookUrl} and ${channel}`)

        
        const messageReportContents = [
          {uelText:{
            text:  pr.title,
            url: pr.html_url
          }},
          {text: `(Create by @${pr.user.login}) `},
          {text:` ${lastUpdatedHoursAgo} 小時以前更新 \n`},
        ]
        reportPullRequest = reportPullRequest.concat(messageReportContents)

        
        const messageTitle = '【PR 巡邏小警察】'
        const messageContents = [
          {title: `▌PR title (Author) : \n`}, 
          {uelText:{
            text:  pr.title,
            url: pr.html_url
          }},
          {text: `(Create by @${pr.user.login}) \n`},
          {title: `▌總計存活時間: \n`},
          {text:`已經存活 ${hoursOpen} 小時${daysOpenMessage} \n`},
          {title: `▌上次更新時間: \n`},
          {text:`已經是 ${lastUpdatedHoursAgo} 小時${lastUpdatedDaysMessage}以前 \n`},
          {title: `▌AI 小警察介紹:\n`},
          {text: aiSuggestion},
        ]

        const slackBlocks = formatSlackMessageBlock(messageTitle, messageContents)
        const messageObject = formatSlackMessage(channel, slackBlocks);
        const resNotification = await sendNotification(webhookUrl, messageObject);
      } catch (error) {
        core.error(error)
        core.error('發送 Slack 通知失敗，請檢查並重新嘗試');
      }
    
    }

    // 串接到 slack
    // 看差異
  } catch (error) {
    core.info(error);
    core.setFailed(error.message);
  }

  // 準備發送 slack message
  try {
    core.info(`=========發送 slack 報告===============`);
    
    const messageTitle = '【PR 報告】'
    const messageContents = [
      {title: `▌統計報告: \n`},
      {text:`有 ${pullRequestExceedTimeCount} 個 PR （ 總計 ${totalPullRequestCount} ）已經 ${PRLastUpdateTimeThreshold} 小時尚未更新，可以持續加油、徵求 Review、考慮關閉\n`},
      {title: `▌簡單報告: \n`},
      ...reportPullRequest
    ]
    const slackBlocks = formatSlackMessageBlock(messageTitle, messageContents)
    const messageObject = formatSlackMessage(channel, slackBlocks);
    const resNotification = await sendNotification(webhookUrl, messageObject);
  } catch (error) {
    core.error(error)
    core.error('發送 Slack 通知失敗，請檢查並重新嘗試');
  }


}

main();

