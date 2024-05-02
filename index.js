
const core = require('@actions/core');
import {execAsync} from './exec-async'
import parseGitDiff from 'parse-git-diff'
const axios = require('axios');

const {
  createPr2UserArray,
  checkGithubProviderFormat,
  prettyMessage,
  stringToObject,
  getTeamsMentions,
  formatSlackMessage,
  formatRocketMessage,
  formatTeamsMessage,
} = require('./functions');


// fix: GITHUB_TOKEN 拿不到
const { GITHUB_TOKEN, GITHUB_API_URL } = process.env;

const GITHUB_REPOSITORY = 'junyiacademy/junyiacademy'

const AUTH_HEADER = {
  Authorization: `token ${GITHUB_TOKEN}`,
};
const PULLS_ENDPOINT = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/pulls`;


/**
 * Get Pull Requests from GitHub repository
 * @return {Promise} Axios promise
 */
async function getPullRequests() {
  return axios({
    method: 'GET',
    url: PULLS_ENDPOINT,
    headers: AUTH_HEADER,
  });
}

function getDateXDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0]; // 返回格式為 YYYY-MM-DD
}

const SEARCH_ENDPOINT = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/pulls`;

async function getOldPullRequests(days) {

  const query = `repo:${GITHUB_REPOSITORY} is:pr is:open created:<${getDateXDaysAgo(days)}`;
  return axios({
    method: 'GET',
    url: SEARCH_ENDPOINT,
    headers: AUTH_HEADER,
    params: {
      q: query
    }
  });
}

async function getPullRequest(pull_number) {

  const endpoint = SEARCH_ENDPOINT + '/' + pull_number
  return axios({
    method: 'GET',
    url: endpoint,
    headers: AUTH_HEADER,
  });
}
 

// call open AI

async function getOpenAI(prompt) {
  var data = JSON.stringify({
    "data": {
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
    }
  });
  var config = {
    method: 'post',
    url: 'https://ci-live-feat-video-ai-dot-junyiacademy.appspot.com/api/v2/jutor/hf-chat',
    headers: { 
      'x-api-key': 'b4c318b8d6f770e10163436e0e868b806f50f34ae57f378e78956fb76b41fd27', 
      'Content-Type': 'application/json', 
      'Cookie': 'fkey=1.0_hWjFLoxRNhhpww%3D%3D_1714508852'
    },
    data : data
  };
  return axios(config);
}

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



/**
 * Main function for the GitHub Action
 */
async function main() {
  try {
    // 獲取開啟一段時間的 PR 
    const webhookUrl = core.getInput('webhook-url');
    const channel = core.getInput('channel');
    const openTime = core.getInput('open-time');
    const pullRequests = await getOldPullRequests(openTime);
    for (const pr of pullRequests.data) {


      // 獲取 Pull Request 標題與內容
      core.info(`==========Fetch Pull Request==============`);
      core.info(`Pull Request Title: ${pr.title}`);
      core.info(`Pull Request Body: ${pr.body}`);
    
      // 制定 Prompt 內容
      core.info(`=========PR_BODY===============`);
      const PR_BODY = pr.body.replace(/\n/g, ' ')
      core.info(PR_BODY);
      
      let ai_suggestion = '本次沒有生成 AI 建議'

      try {
        core.info(`=========Open AI===============`);
        const prompt = `Github Pull Request 內容如下
        標題：${pr.title} 內容：${PR_BODY}
        -----
        請幫我根據以上的標題與內容，用中文遵守以下格式，回答
        1. 簡單介紹 PR 內容
        2. 推薦什麼樣工程師 Review（什麼背景 / 興趣的人）
        `
  
        const ai_response_test = await getOpenAI("請說聲你好")
        const ai_response_test_ok = ai_response_test.data.data.choices[0].message.content
  
        core.info(ai_response_test_ok);
        
        //  這邊可以調整一下，如果 fail 送提醒就好
        const ai_response = await getOpenAI(prompt)
        const ai_suggestion = ai_response.data.data.choices[0].message.content
  
        core.info(ai_suggestion);
      } catch (error) {
        core.error('Open AI 失敗，請檢查並重新嘗試');
      }

      // 獲取內容
      // core.info(ai_suggestion)

      const prCreatedAt = new Date(pr.created_at);
      const currentTime = new Date();
      const timeDiff = Math.abs(currentTime - prCreatedAt);
      const hoursOpen = Math.floor((timeDiff / (1000 * 60 * 60)));

      const prLink = pr.html_url;

      const prUpdatedAt = new Date(pr.updated_at);
      const lastUpdatedHoursAgo = Math.floor((currentTime - prUpdatedAt) / (1000 * 60 * 60));

//       const slack_message = `【PR巡警】這個 PR「${pr.title}」，已經開啟了 ${hoursOpen} hr ，上次更新時間是 ${lastUpdatedHoursAgo} hr 以前 \n
// *AI小警察介紹*：${ai_suggestion}\n
// *PR連結*：${prLink}
// ========
// `
      // core.info(slack_message)

      const slack_block =  [
          {
            "type": "header",
            "text": {
              "type": "plain_text",
              "text": "PR 巡邏小警察",
              "emoji": true
            }
          },
          {
            "type": "rich_text",
            "elements": [
              {
                "type": "rich_text_section",
                "elements": [
                  {
                    "type": "text",
                    "text": "說明:\n",
                    "style": {
                      "bold": true
                    }
                  },
                  {
                    "type": "text",
                    "text": `此 PR 「${pr.title}」已經開啟 ${hoursOpen}  小時，上次更新時間是 ${lastUpdatedHoursAgo} hr 以前`
                  }
                ]
              }
            ]
          },
          {
            "type": "rich_text",
            "elements": [
              {
                "type": "rich_text_section",
                "elements": [
                  {
                    "type": "text",
                    "text": "AI 小警察介紹:\n",
                    "style": {
                      "bold": true
                    }
                  },
                  {
                    "type": "text",
                    "text": `${ai_suggestion}`
                  }
                ]
              }
            ]
          },
          {
            "type": "actions",
            "elements": [
              {
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "emoji": true,
                  "text": "查看 PR 詳細內容"
                },
                "style": "primary",
                "url": prLink
              }
            ]
          }
      ]


      const messageObject = formatSlackMessage(channel, slack_block);
      const resNotification = await sendNotification(webhookUrl, messageObject);
      
    
    }

    // 串接到 slack
    // 看差異
  } catch (error) {
    core.info(error);
    core.setFailed(error.message);
  }
}

main();

